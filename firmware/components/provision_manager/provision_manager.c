#include "provision_manager.h"

#include "logger.h"
#include "device_info.h"
#include "led_manager.h"
#include "config_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_http_server.h"
#include "esp_http_client.h"
#include "lwip/sockets.h"
#include "sys/param.h"
#include "cJSON.h"
#include "mdns.h"

#include <string.h>
#include <strings.h>
#include <stdio.h>
#include <stdlib.h>


#define WIFI_CONNECT_TIMEOUT_MS 15000
#define CLAIM_HTTP_TIMEOUT_MS   10000
#define HUB_ADDRESS_MAX         64
#define CLAIM_CODE_MAX          16

#define STA_CONNECTED_BIT BIT0
#define STA_FAIL_BIT       BIT1

static const char *TAG = "PROVISION";

static httpd_handle_t server = NULL;
static EventGroupHandle_t sta_event_group = NULL;

extern const uint8_t hub_ca_cert_pem_start[] asm("_binary_hub_ca_cert_pem_start");
extern const uint8_t hub_ca_cert_pem_end[]   asm("_binary_hub_ca_cert_pem_end");

typedef struct{
    char *buffer;
    size_t size;
    size_t written;
}http_response_buffer_t;

typedef struct{
    bool success;
    char mqtt_uri[128];
    char mqtt_username[32];
    char mqtt_password[48];
    char error[128];
}claim_result_t;

static const char html_form[] = 
    "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<style>body{font-family:Arial,sans-serif;margin:20px;padding:0;background:#f4f4f9;}"
    ".card{background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);max-width:400px;margin:auto;}"
    "label{display:block;margin-top:10px;font-weight:bold;font-size:14px;}"
    "input,select,button{width:100%;padding:10px;margin:6px 0;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;font-size:14px;}"
    "button{background-color:#007bff;color:white;border:none;cursor:pointer;font-weight:bold;margin-top:16px;}"
    "button:hover{background-color:#0056b3;}"
    "#manual_wrap{display:none;}"
    "</style></head><body>"
    "<div class='card'><h2>Device Configuration</h2>"
    "<form action='/save' method='POST' id='form'>"
    "<label>WiFi Network:</label>"
    "<select name='ssid' id='ssid_select'><option value=''>Scanning...</option></select>"
    "<div id='manual_wrap'><label>Network Name (manual):</label>"
    "<input type='text' name='ssid_manual' id='ssid_manual'></div>"
    "<label>WiFi Password:</label><input type='password' name='password' required>"
    "<label>Hub Address:</label><input type='text' name='hub_address' value='smarthome-hub.local' required>"
    "<label>Claim Code:</label><input type='text' name='claim_code' placeholder='from Add Device page' required style='text-transform:uppercase;'>"
    "<button type='submit'>Save & Apply</button>"
    "</form></div>"
    "<script>"
    "const sel=document.getElementById('ssid_select');"
    "const manualWrap=document.getElementById('manual_wrap');"
    "const manualInput=document.getElementById('ssid_manual');"
    "function addManualOption(){"
      "const o=document.createElement('option');"
      "o.value='__manual__';o.textContent='Other (enter manually)';"
      "sel.appendChild(o);"
    "}"
    "fetch('/scan').then(r=>r.json()).then(list=>{"
      "sel.innerHTML='';"
      "list.sort((a,b)=>b.rssi-a.rssi);"
      "list.forEach(net=>{"
        "const o=document.createElement('option');"
        "o.value=net.ssid;o.textContent=net.ssid+' ('+net.rssi+' dBm)';"
        "sel.appendChild(o);"
      "});"
      "addManualOption();"
      "if(list.length===0){sel.value='__manual__';manualWrap.style.display='block';}"
    "}).catch(()=>{"
      "sel.innerHTML='';addManualOption();sel.value='__manual__';"
      "manualWrap.style.display='block';"
    "});"
    "sel.addEventListener('change',()=>{"
      "manualWrap.style.display = sel.value==='__manual__' ? 'block' : 'none';"
    "});"
    "document.getElementById('form').addEventListener('submit',(e)=>{"
      "if(sel.value==='__manual__' && !manualInput.value){e.preventDefault();alert('Enter the network name');}"
    "});"
    "</script>"
    "</body></html>";

static int hex_digit_value(char c){
    if((c >= '0') && (c <= '9'))
        return c - '0';
    if((c >= 'a') && (c <= 'f'))
        return c - 'a' + 10;
    if((c >= 'A') && (c <= 'F'))
        return c - 'A' + 10;
    return -1;
}

static void url_decode(char *str){

    char *read = str;
    char *write = str;

    while(*read != '\0'){

        if(*read == '+'){
            *write = ' ';
            read++;
            write++;
        }
        else if((*read == '%') && (read[1] != '\0') && (read[2] != '\0')){
            int high = hex_digit_value(read[1]);
            int low  = hex_digit_value(read[2]);
            if((high >= 0) && (low >= 0)){
                *write = (char)((high << 4) | low);
                read += 3;
                write++;
            }
            else{
                /* malformed %-sequence: copy the '%' through literally rather than guessing */
                *write = *read;
                read++;
                write++;
            }
        }
        else{
            *write = *read;
            read++;
            write++;
        }
    }

    *write = '\0';
}

/* Minimal JSON string escaping for SSIDs - handles the characters that
 * would otherwise break the JSON we hand-build in provision_scan. */
static void json_escape_append(char *out, size_t out_size, size_t *offset, const char *in){

    for(const char *p = in;(*p != '\0') && (*offset < out_size - 2);p++){
        if((*p == '"') || (*p == '\\')){
            out[(*offset)++] = '\\';
            if(*offset >= out_size - 2)
                break;
        }
        out[(*offset)++] = *p;
    }

}

/*==========================================================
 * STA connect (for the WiFi-join step during provisioning)
 *=========================================================*/

static void provision_sta_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data){

    if((event_base == WIFI_EVENT) && (event_id == WIFI_EVENT_STA_DISCONNECTED)){
        if(sta_event_group != NULL)
            xEventGroupSetBits(sta_event_group, STA_FAIL_BIT);
    }
    else if((event_base == IP_EVENT) && (event_id == IP_EVENT_STA_GOT_IP)){
        if(sta_event_group != NULL)
            xEventGroupSetBits(sta_event_group, STA_CONNECTED_BIT);
    }

}

/* One-shot, timeout-bounded connect - deliberately NOT the same as
 * wifi_manager's forever-retry-with-backoff task (that only starts once
 * provisioning is already complete). Here we need a bounded attempt so a
 * bad password fails back to the portal instead of hanging silently. */
static bool provision_wifi_connect(const char *ssid, const char *password){

    xEventGroupClearBits(sta_event_group, STA_CONNECTED_BIT | STA_FAIL_BIT);

    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, ssid, sizeof(wifi_config.sta.ssid) - 1);
    strncpy((char *)wifi_config.sta.password, password, sizeof(wifi_config.sta.password) - 1);

    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    esp_wifi_connect();

    EventBits_t bits = xEventGroupWaitBits(sta_event_group, STA_CONNECTED_BIT | STA_FAIL_BIT,
        pdFALSE, pdFALSE, pdMS_TO_TICKS(WIFI_CONNECT_TIMEOUT_MS));

    return (bits & STA_CONNECTED_BIT) != 0;

}

/*==========================================================
 * Hub claim request
 *=========================================================*/

static esp_err_t claim_http_event_handler(esp_http_client_event_t *evt){

    http_response_buffer_t *resp = (http_response_buffer_t *)evt->user_data;

    if((evt->event_id == HTTP_EVENT_ON_DATA) && (resp != NULL) && (resp->buffer != NULL)){
        size_t remaining = resp->size - resp->written - 1;
        size_t to_copy = ((size_t)evt->data_len < remaining) ? (size_t)evt->data_len : remaining;
        if(to_copy > 0){
            memcpy(resp->buffer + resp->written, evt->data, to_copy);
            resp->written += to_copy;
            resp->buffer[resp->written] = '\0';
        }
    }

    return ESP_OK;
}

static bool has_local_suffix(const char *s){

    size_t len = strlen(s);

    return (len >= 6) && (strcasecmp(s + len - 6, ".local") == 0);

}

/* esp_http_client's normal DNS path does NOT understand mDNS - ".local"
 * names need the dedicated mdns component. If hub_address isn't a
 * ".local" name, this is a no-op and the caller uses it as-is (works
 * for both a raw IP and a regular resolvable hostname). */
static bool resolve_hub_address(const char *hub_address, char *out, size_t out_size){

    if(!has_local_suffix(hub_address)){
        strncpy(out, hub_address, out_size - 1);
        out[out_size - 1] = '\0';
        return true;
    }

    char hostname[64];
    strncpy(hostname, hub_address, sizeof(hostname) - 1);
    hostname[sizeof(hostname) - 1] = '\0';
    hostname[strlen(hostname) - 6] = '\0';  /* strip trailing ".local" */

    esp_ip4_addr_t addr;
    esp_err_t err = mdns_query_a(hostname, 2000, &addr);
    if(err != ESP_OK){
        LOG_ERROR(TAG, "mDNS lookup failed for '%s.local': %s", hostname, esp_err_to_name(err));
        return false;
    }

    snprintf(out, out_size, IPSTR, IP2STR(&addr));

    LOG_INFO(TAG, "Resolved '%s.local' -> %s", hostname, out);

    return true;

}

static void provision_claim_device(const char *hub_address, const char *claim_code, claim_result_t *result){

    memset(result, 0, sizeof(claim_result_t));

    char resolved_address[64];
    if(!resolve_hub_address(hub_address, resolved_address, sizeof(resolved_address))){
        snprintf(result->error, sizeof(result->error), "Could not resolve hub address '%s'", hub_address);
        return;
    }

    char url[128];
    snprintf(url, sizeof(url), "https://%s:5000/api/provision/claim", resolved_address);

    char id_hex[DEVICE_ID_HEX_LEN];
    device_info_get_id_hex(id_hex, sizeof(id_hex));

    const device_info_t *info = device_info_get();

    cJSON *body = cJSON_CreateObject();
    cJSON_AddStringToObject(body, "claim_code", claim_code);
    cJSON_AddStringToObject(body, "hardware_id", id_hex);
    cJSON_AddStringToObject(body, "device_type", device_type_to_string(info->type));
    char *body_json = cJSON_PrintUnformatted(body);
    cJSON_Delete(body);

    char response_data[512];
    response_data[0] = '\0';
    http_response_buffer_t response_buffer = { .buffer = response_data, .size = sizeof(response_data), .written = 0 };

    esp_http_client_config_t http_config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = CLAIM_HTTP_TIMEOUT_MS,
        .cert_pem = (const char *)hub_ca_cert_pem_start,
        .cert_len = hub_ca_cert_pem_end - hub_ca_cert_pem_start,
        .event_handler = claim_http_event_handler,
        .user_data = &response_buffer
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_config);
    if(client == NULL){
        snprintf(result->error, sizeof(result->error), "Failed to init HTTP client");
        cJSON_free(body_json);
        return;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, body_json, strlen(body_json));

    esp_err_t err = esp_http_client_perform(client);
    int status_code = esp_http_client_get_status_code(client);

    esp_http_client_cleanup(client);
    cJSON_free(body_json);

    if(err != ESP_OK){
        snprintf(result->error, sizeof(result->error), "Could not reach hub: %s", esp_err_to_name(err));
        return;
    }

    cJSON *response_json = cJSON_Parse(response_data);
    if(response_json == NULL){
        snprintf(result->error, sizeof(result->error), "Hub returned HTTP %d with an invalid response", status_code);
        return;
    }

    cJSON *success = cJSON_GetObjectItem(response_json, "success");
    if((success == NULL) || !cJSON_IsBool(success) || !cJSON_IsTrue(success)){
        cJSON *error_field = cJSON_GetObjectItem(response_json, "error");
        snprintf(result->error, sizeof(result->error), "%s",
            ((error_field != NULL) && cJSON_IsString(error_field)) ? error_field->valuestring : "Hub rejected the claim request");
        cJSON_Delete(response_json);
        return;
    }

    cJSON *data = cJSON_GetObjectItem(response_json, "data");
    cJSON *mqtt_uri = cJSON_GetObjectItem(data, "mqtt_uri");
    cJSON *mqtt_username = cJSON_GetObjectItem(data, "mqtt_username");
    cJSON *mqtt_password = cJSON_GetObjectItem(data, "mqtt_password");

    if((mqtt_uri == NULL) || (mqtt_username == NULL) || (mqtt_password == NULL) ||
       !cJSON_IsString(mqtt_uri) || !cJSON_IsString(mqtt_username) || !cJSON_IsString(mqtt_password)){
        snprintf(result->error, sizeof(result->error), "Hub response missing credentials");
        cJSON_Delete(response_json);
        return;
    }

    strncpy(result->mqtt_uri, mqtt_uri->valuestring, sizeof(result->mqtt_uri) - 1);
    strncpy(result->mqtt_username, mqtt_username->valuestring, sizeof(result->mqtt_username) - 1);
    strncpy(result->mqtt_password, mqtt_password->valuestring, sizeof(result->mqtt_password) - 1);
    result->success = true;

    cJSON_Delete(response_json);

}

/*==========================================================
 * HTTP handlers
 *=========================================================*/

static esp_err_t provision_render(httpd_req_t *req){

    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_form, HTTPD_RESP_USE_STRLEN);

    return ESP_OK;
}

static esp_err_t provision_submit(httpd_req_t *req){

    char content[896] = {0};
    char *token = NULL;
    char ssid_str[256];
    char ssid[32];
    char ssid_manual_str[256];
    char ssid_manual[32];
    char pass_str[256];
    char pass[64];
    char hub_address_str[128];
    char hub_address[HUB_ADDRESS_MAX];
    char claim_code_str[64];
    char claim_code[CLAIM_CODE_MAX];

    memset(ssid_manual, 0, sizeof(ssid_manual));

    size_t recv_size = MIN(req->content_len, sizeof(content) - 1);
    int ret = httpd_req_recv(req, content, recv_size);
    if(ret <= 0){
        if(ret == HTTPD_SOCK_ERR_TIMEOUT)
            httpd_resp_send_408(req);
        return ESP_FAIL;
    }

    LOG_INFO(TAG, "Form Submission Payload: %s", content);

    /* NOTE: parsing here is positional and MUST match the field order declared
     * in html_form exactly: ssid, ssid_manual, password, hub_address, claim_code. */
    token = strtok(content, "&");
    if(token != NULL)
        snprintf(ssid_str, sizeof(ssid_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(ssid_manual_str, sizeof(ssid_manual_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(pass_str, sizeof(pass_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(hub_address_str, sizeof(hub_address_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(claim_code_str, sizeof(claim_code_str), "%s", token);

    token = strtok(ssid_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(ssid, sizeof(ssid), "%s", token);

    token = strtok(ssid_manual_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(ssid_manual, sizeof(ssid_manual), "%s", token);

    token = strtok(pass_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(pass, sizeof(pass), "%s", token);

    token = strtok(hub_address_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(hub_address, sizeof(hub_address), "%s", token);

    token = strtok(claim_code_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(claim_code, sizeof(claim_code), "%s", token);

    url_decode(ssid);
    url_decode(ssid_manual);
    url_decode(pass);
    url_decode(hub_address);
    url_decode(claim_code);

    /* "__manual__" is the sentinel the portal's <select> uses when the
     * user picked "Other (enter manually)" - swap in what they typed. */
    if(strcmp(ssid, "__manual__") == 0){
        strncpy(ssid, ssid_manual, sizeof(ssid) - 1);
        ssid[sizeof(ssid) - 1] = '\0';
    }

    LOG_INFO(TAG, "Attempting WiFi connection to '%s'...", ssid);

    if(!provision_wifi_connect(ssid, pass)){

        LOG_ERROR(TAG, "Failed to connect to WiFi network '%s'", ssid);

        const char *resp =
            "<html><body><h2>Setup Failed</h2>"
            "<p>Could not connect to that WiFi network. Check the password and try again.</p>"
            "<p><a href='/'>Go back and try again</a></p></body></html>";
        httpd_resp_send(req, resp, HTTPD_RESP_USE_STRLEN);

        return ESP_OK;
    }

    LOG_INFO(TAG, "WiFi connected, claiming device with hub %s...", hub_address);

    /* Nothing persisted to NVS yet at this point - a failure from here
     * on leaves the device's saved config exactly as it was before this
     * attempt, so the portal is safe to retry. */
    claim_result_t claim_result;
    provision_claim_device(hub_address, claim_code, &claim_result);

    if(!claim_result.success){

        LOG_ERROR(TAG, "Claim failed: %s", claim_result.error);

        esp_wifi_disconnect();

        char error_resp[384];
        snprintf(error_resp, sizeof(error_resp),
            "<html><body><h2>Setup Failed</h2>"
            "<p>%s</p>"
            "<p><a href='/'>Go back and try again</a></p></body></html>",
            claim_result.error);
        httpd_resp_send(req, error_resp, HTTPD_RESP_USE_STRLEN);

        return ESP_OK;
    }

    LOG_INFO(TAG, "Device claimed successfully");

    config_manager_update_wifi_credentials(ssid, pass);
    config_manager_update_mqtt_uri(claim_result.mqtt_uri);
    config_manager_update_mqtt_credentials(claim_result.mqtt_username, claim_result.mqtt_password);
    config_manager_mark_provisioned();

    const char *resp = "<html><body><h2>Setup Complete!</h2><p>Restarting...</p></body></html>";
    httpd_resp_send(req, resp, HTTPD_RESP_USE_STRLEN);

    vTaskDelay(pdMS_TO_TICKS(1000));

    esp_restart();

    return ESP_OK;
}

static esp_err_t provision_scan(httpd_req_t *req){

    wifi_scan_config_t scan_config = { .show_hidden = false };

    if(esp_wifi_scan_start(&scan_config, true) != ESP_OK){
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "[]", HTTPD_RESP_USE_STRLEN);
        return ESP_OK;
    }

    uint16_t record_count = 20;
    wifi_ap_record_t *ap_records = calloc(record_count, sizeof(wifi_ap_record_t));
    char *json = malloc(1536);
    char (*seen_ssids)[33] = malloc(20 * sizeof(*seen_ssids));

    if((ap_records == NULL) || (json == NULL) || (seen_ssids == NULL)){
        LOG_ERROR(TAG, "Failed to allocate scan result buffers");
        free(ap_records);
        free(json);
        free(seen_ssids);
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "[]", HTTPD_RESP_USE_STRLEN);
        return ESP_OK;
    }

    esp_wifi_scan_get_ap_records(&record_count, ap_records);

    int seen_count = 0;
    size_t offset = 0;
    offset += snprintf(json + offset, 1536 - offset, "[");

    bool first = true;
    for(int i = 0;(i < record_count) && (offset < 1536 - 100);i++){

        const char *ssid = (const char *)ap_records[i].ssid;
        if(strlen(ssid) == 0)
            continue;

        bool duplicate = false;
        for(int j = 0;j < seen_count;j++){
            if(strcmp(seen_ssids[j], ssid) == 0){
                duplicate = true;
                break;
            }
        }
        if(duplicate)
            continue;

        if(seen_count < 20){
            strncpy(seen_ssids[seen_count], ssid, 32);
            seen_ssids[seen_count][32] = '\0';
            seen_count++;
        }

        if(!first)
            offset += snprintf(json + offset, 1536 - offset, ",");
        first = false;

        offset += snprintf(json + offset, 1536 - offset, "{\"ssid\":\"");
        json_escape_append(json, 1536, &offset, ssid);
        offset += snprintf(json + offset, 1536 - offset, "\",\"rssi\":%d}", ap_records[i].rssi);

    }

    offset += snprintf(json + offset, 1536 - offset, "]");

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json, HTTPD_RESP_USE_STRLEN);

    free(ap_records);
    free(json);
    free(seen_ssids);

    return ESP_OK;
}

static esp_err_t provision_redirect(httpd_req_t *req){

    httpd_resp_set_status(req, "302 Found");
    httpd_resp_set_hdr(req, "Location", "http://192.168.4.1/");
    const char *resp = "Redirecting to portal...";
    httpd_resp_send(req, resp, HTTPD_RESP_USE_STRLEN);

    return ESP_OK;
}

static esp_err_t provision_manager_start_ap(void){

    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_ap();
    esp_netif_create_default_wifi_sta();   /* needed so esp_wifi_scan_start()/STA connect have an interface */

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    LOG_INFO(TAG, "WiFi initialized");

    sta_event_group = xEventGroupCreate();
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, WIFI_EVENT_STA_DISCONNECTED, provision_sta_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, provision_sta_event_handler, NULL));

    char id_hex[DEVICE_ID_HEX_LEN];
    device_info_get_id_hex(id_hex, sizeof(id_hex));

    const device_info_t *info = device_info_get();

    uint8_t wifi_ssid[32];
    snprintf((char *)wifi_ssid, sizeof(wifi_ssid), "%s-Setup-%s", device_type_to_setup_prefix(info->type), id_hex);

    LOG_INFO(TAG, "=====================================================");
    LOG_INFO(TAG, " Setup network : %s (open, no password)", wifi_ssid);
    LOG_INFO(TAG, "=====================================================");

    wifi_config_t wifi_config = {0};
    wifi_config.ap.channel = 1;
    wifi_config.ap.authmode = WIFI_AUTH_OPEN;
    wifi_config.ap.max_connection = 4;
    wifi_config.ap.ssid_len = strlen((char*)wifi_ssid);
    strncpy((char *)wifi_config.ap.ssid, (char *)wifi_ssid, sizeof(wifi_config.ap.ssid) - 1);
    
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    esp_err_t mdns_err = mdns_init();
    if(mdns_err != ESP_OK)
        LOG_WARN(TAG, "mDNS init failed (%s) - .local hub addresses won't resolve, raw IP still works", esp_err_to_name(mdns_err));

    return ESP_OK;
}

static esp_err_t provision_manager_start_server(void){

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.max_open_sockets = 7;
    config.lru_purge_enable = true;
    config.stack_size = 8192;

    if(httpd_start(&server, &config) != ESP_OK){
        LOG_INFO(TAG, "http server start Failed!");
        return ESP_FAIL;
    }

    LOG_INFO(TAG, "http server started successfully");

    const httpd_uri_t uri_get = {
        .uri = "/",
        .method = HTTP_GET,
        .handler = provision_render,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(server, &uri_get);
    const httpd_uri_t uri_post = {
        .uri = "/save",
        .method = HTTP_POST,
        .handler = provision_submit,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(server, &uri_post);
    const httpd_uri_t uri_scan = {
        .uri = "/scan",
        .method = HTTP_GET,
        .handler = provision_scan,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(server, &uri_scan);
    const httpd_uri_t uri_redirect = {
        .uri = "/*",
        .method = HTTP_GET,
        .handler = provision_redirect,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(server, &uri_redirect);

    return ESP_OK;
}

static void provision_dns_server_task(void *pvParameters){

    uint8_t rx_buffer[128];
    struct sockaddr_in server_addr = {
        .sin_family = AF_INET,
        .sin_port = htons(53),
        .sin_addr.s_addr = htonl(INADDR_ANY)
    };

    int sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    bind(sock, (struct sockaddr *)&server_addr, sizeof(server_addr));

    while(1){

        struct sockaddr_in client_addr;
        socklen_t client_addr_len = sizeof(client_addr);
        int len = recvfrom(sock, rx_buffer, sizeof(rx_buffer), 0, (struct sockaddr *)&client_addr, &client_addr_len);

        if (len > 12) {
            rx_buffer[2] |= 0x80;
            rx_buffer[3] |= 0x80;
            rx_buffer[6] = 0x00; rx_buffer[7] = 0x01;

            int query_len = len;
            uint8_t answer[] = {
                0xc0, 0x0c,
                0x00, 0x01,
                0x00, 0x01,
                0x00, 0x00, 0x00, 0x3c,
                0x00, 0x04,
                192, 168, 4, 1
            };

            memcpy(rx_buffer + query_len, answer, sizeof(answer));
            sendto(sock, rx_buffer, query_len + sizeof(answer), 0, (struct sockaddr *)&client_addr, client_addr_len);
        }
    }
}

esp_err_t provision_manager_init(void){

    esp_err_t err = provision_manager_start_ap();
    if(err != ESP_OK)
        return err;

    err = provision_manager_start_server();
    if(err != ESP_OK)
        return err;

    led_manager_set_state(LED_STATE_PROVISIONING);

    xTaskCreate(provision_dns_server_task, "provision_dns_server", 4096, NULL, 5, NULL);

    return ESP_OK;
}