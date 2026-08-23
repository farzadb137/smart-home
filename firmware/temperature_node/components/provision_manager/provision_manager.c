#include "provision_manager.h"

#include "logger.h"
#include "device_info.h"
#include "led_manager.h"
#include "config_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "lwip/sockets.h"
#include "esp_http_server.h"
#include "sys/param.h"

#include <string.h>
#include <stdio.h>

static const char *TAG = "PROVISION";

static httpd_handle_t server = NULL;

static const char html_form[] = 
    "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<style>body{font-family:Arial,sans-serif;margin:20px;padding:0;background:#f4f4f9;}"
    ".card{background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);max-width:400px;margin:auto;}"
    "input,button{width:100%;padding:10px;margin:8px 0;box-sizing:border-box;border:1px solid #ccc;border-radius:4px;}"
    "button{background-color:#007bff;color:white;border:none;cursor:pointer;font-weight:bold;}"
    "button:hover{background-color:#0056b3;}</style></head><body>"
    "<div class='card'><h2>Device Configuration</h2>"
    "<form action='/save' method='POST'>"
    "<label>SSID:</label><input type='text' name='ssid' required>"
    "<label>WiFi Password:</label><input type='password' name='password' required>"
    "<label>MQTT Broker URI:</label><input type='text' name='mqtt' placeholder='mqtt://192.168.1.100\' required>"
    "<label>MQTT Username:</label><input type='text' name='mqtt_user' placeholder='issued by add_device.sh' required>"
    "<label>MQTT Password:</label><input type='text' name='mqtt_pass' placeholder='issued by add_device.sh' required>"
    "<button type='submit'>Save & Apply</button>"
    "</form></div></body></html>";

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

static esp_err_t provision_render(httpd_req_t *req){

    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_form, HTTPD_RESP_USE_STRLEN);

    return ESP_OK;
}

static esp_err_t provision_submit(httpd_req_t *req){

    char content[768] = {0};
    char *token = NULL;
    char ssid_str[256];
    char ssid[32];
    char pass_str[256];
    char pass[64];
    char uri_str[256];
    char uri[128];
    char mqtt_user_str[128];
    char mqtt_user[32];
    char mqtt_pass_str[128];
    char mqtt_pass[48];

    size_t recv_size = MIN(req->content_len, sizeof(content) - 1);
    int ret = httpd_req_recv(req, content, recv_size);
    if(ret <= 0){
        if(ret == HTTPD_SOCK_ERR_TIMEOUT)
            httpd_resp_send_408(req);
        return ESP_FAIL;
    }

    LOG_INFO(TAG, "Form Submission Payload: %s", content);

    /* NOTE: parsing here is positional and MUST match the field order declared
     * in html_form exactly: ssid, password, mqtt, mqtt_user, mqtt_pass. */
    token = strtok(content, "&");
    if(token != NULL)
        snprintf(ssid_str, sizeof(ssid_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(pass_str, sizeof(pass_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(uri_str, sizeof(uri_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(mqtt_user_str, sizeof(mqtt_user_str), "%s", token);
    token = strtok(NULL, "&");
    if(token != NULL)
        snprintf(mqtt_pass_str, sizeof(mqtt_pass_str), "%s", token);

    token = strtok(ssid_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(ssid, sizeof(ssid), "%s", token);

    token = strtok(pass_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(pass, sizeof(pass), "%s", token);

    token = strtok(uri_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(uri, sizeof(uri), "%s", token);

    token = strtok(mqtt_user_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(mqtt_user, sizeof(mqtt_user), "%s", token);

    token = strtok(mqtt_pass_str, "=");
    token = strtok(NULL, "=");
    if(token != NULL)
        snprintf(mqtt_pass, sizeof(mqtt_pass), "%s", token);

    url_decode(ssid);
    url_decode(pass);
    url_decode(uri);
    url_decode(mqtt_user);
    url_decode(mqtt_pass);

    config_manager_update_mqtt_uri(uri);
    config_manager_update_mqtt_credentials(mqtt_user, mqtt_pass);
    config_manager_update_wifi_credentials(ssid, pass);
    config_manager_mark_provisioned();

    const char *resp = "<html><body><h2>Data Received Successfully!</h2></body></html>";
    httpd_resp_send(req, resp, HTTPD_RESP_USE_STRLEN);

    vTaskDelay(pdMS_TO_TICKS(1000));

    esp_restart();

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

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    LOG_INFO(TAG, "WiFi initialized");
    
    const device_info_t *info = device_info_get();

    uint8_t wifi_ssid[32];
    snprintf((char *)wifi_ssid, sizeof(wifi_ssid), "SmartTemp-Setup-%d", (uint16_t)info->id);

    wifi_config_t wifi_config = {0};
    wifi_config.ap.channel = 1;
    wifi_config.ap.authmode = WIFI_AUTH_OPEN;
    wifi_config.ap.max_connection = 4;
    wifi_config.ap.ssid_len = strlen((char*)wifi_ssid);
    strncpy((char *)wifi_config.ap.ssid, (char *)wifi_ssid, sizeof(wifi_config.ap.ssid) - 1);

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    return ESP_OK;
}

static esp_err_t provision_manager_start_server(void){

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.max_open_sockets = 7;
    config.lru_purge_enable = true;

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
            // Modify packet to convert DNS Query into a Response pointing to 192.168.4.1
            rx_buffer[2] |= 0x80; // QR bit: Response
            rx_buffer[3] |= 0x80; // RA bit: Recursion Available
            rx_buffer[6] = 0x00; rx_buffer[7] = 0x01; // Answer Count = 1

            int query_len = len;
            // Append static DNS Answer (A Record -> 192.168.4.1)
            uint8_t answer[] = {
                0xc0, 0x0c,             // Pointer to query name
                0x00, 0x01,             // Type: A
                0x00, 0x01,             // Class: IN
                0x00, 0x00, 0x00, 0x3c, // TTL: 60s
                0x00, 0x04,             // Data length: 4
                192, 168, 4, 1          // IP: 192.168.4.1
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