#include "ota_manager.h"

#include "logger.h"

#include "esp_http_client.h"
#include "esp_ota_ops.h"
#include "esp_system.h"
#include "mbedtls/md.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <string.h>
#include <strings.h>
#include <stdio.h>
#include <stdlib.h>

#define OTA_BUFFER_SIZE 1024
#define OTA_URL_MAX 256
#define OTA_HASH_HEX_LEN 65

static const char *TAG = "OTA";

extern const uint8_t ca_cert_pem_start[] asm("_binary_ota_ca_cert_pem_start");
extern const uint8_t ca_cert_pem_end[]   asm("_binary_ota_ca_cert_pem_end");

typedef struct{
    char url[OTA_URL_MAX];
    char expected_sha256[OTA_HASH_HEX_LEN];
    ota_status_callback_t callback;
}ota_task_args_t;

/*==========================================================
 * Private Functions
 *=========================================================*/

static void sha256_to_hex(const unsigned char *hash, char *out){

    for(int i = 0;i < 32;i++)
        sprintf(out + (i * 2), "%02x", hash[i]);

    out[64] = '\0';

}

static void ota_task(void *pv){

    ota_task_args_t *args = (ota_task_args_t *)pv;
    bool success = false;
    char message[128] = "OTA failed";

    const esp_partition_t *target = esp_ota_get_next_update_partition(NULL);
    if(target == NULL){
        LOG_ERROR(TAG, "No OTA partition available");
        snprintf(message, sizeof(message), "No OTA partition available");
        goto done;
    }

    LOG_INFO(TAG, "OTA target partition: %s at 0x%lx", target->label, target->address);

    esp_http_client_config_t http_config = {
        .url = args->url,
        .timeout_ms = 15000,
        .keep_alive_enable = true,
        .cert_pem = (const char *)ca_cert_pem_start,
        .cert_len = ca_cert_pem_end - ca_cert_pem_start
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_config);
    if(client == NULL){
        snprintf(message, sizeof(message), "Failed to init HTTP client");
        goto done;
    }

    if(esp_http_client_open(client, 0) != ESP_OK){
        snprintf(message, sizeof(message), "Failed to connect to firmware server");
        esp_http_client_cleanup(client);
        goto done;
    }

    int content_length = esp_http_client_fetch_headers(client);
    int status_code = esp_http_client_get_status_code(client);
    if(status_code != 200){
        LOG_ERROR(TAG, "HTTP status %d fetching firmware", status_code);
        snprintf(message, sizeof(message), "Firmware server returned HTTP %d", status_code);
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        goto done;
    }

    LOG_INFO(TAG, "Downloading firmware, content length: %d", content_length);

    esp_ota_handle_t ota_handle;
    if(esp_ota_begin(target, OTA_SIZE_UNKNOWN, &ota_handle) != ESP_OK){
        snprintf(message, sizeof(message), "Failed to begin OTA write");
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        goto done;
    }

    const mbedtls_md_info_t *md_info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    mbedtls_md_context_t md_ctx;
    mbedtls_md_init(&md_ctx);
    mbedtls_md_setup(&md_ctx, md_info, 0);
    mbedtls_md_starts(&md_ctx);

    uint8_t buffer[OTA_BUFFER_SIZE];
    int total_read = 0;
    bool write_failed = false;

    while(1){

        int read_len = esp_http_client_read(client, (char *)buffer, OTA_BUFFER_SIZE);
        if(read_len < 0){
            LOG_ERROR(TAG, "HTTP read error");
            write_failed = true;
            break;
        }
        if(read_len == 0)
            break;

        if(esp_ota_write(ota_handle, buffer, read_len) != ESP_OK){
            LOG_ERROR(TAG, "esp_ota_write failed");
            write_failed = true;
            break;
        }

        mbedtls_md_update(&md_ctx, buffer, read_len);
        total_read += read_len;

    }

    esp_http_client_close(client);
    esp_http_client_cleanup(client);

    if(write_failed){
        snprintf(message, sizeof(message), "Download/write failed after %d bytes", total_read);
        esp_ota_abort(ota_handle);
        mbedtls_md_free(&md_ctx);
        goto done;
    }

    LOG_INFO(TAG, "Downloaded %d bytes total", total_read);

    unsigned char hash[32];
    mbedtls_md_finish(&md_ctx, hash);
    mbedtls_md_free(&md_ctx);

    char hash_hex[OTA_HASH_HEX_LEN];
    sha256_to_hex(hash, hash_hex);

    LOG_INFO(TAG, "Computed SHA-256: %s", hash_hex);

    if(strcasecmp(hash_hex, args->expected_sha256) != 0){
        LOG_ERROR(TAG, "SHA-256 mismatch - expected %s", args->expected_sha256);
        snprintf(message, sizeof(message), "SHA-256 mismatch, image rejected");
        esp_ota_abort(ota_handle);
        goto done;
    }

    if(esp_ota_end(ota_handle) != ESP_OK){
        snprintf(message, sizeof(message), "Image validation failed");
        goto done;
    }

    if(esp_ota_set_boot_partition(target) != ESP_OK){
        snprintf(message, sizeof(message), "Failed to set boot partition");
        goto done;
    }

    LOG_INFO(TAG, "OTA successful, restarting to apply");
    success = true;
    snprintf(message, sizeof(message), "OTA successful, restarting");

done:

    if(args->callback != NULL)
        args->callback(success, message);

    free(args);

    if(success){
        vTaskDelay(pdMS_TO_TICKS(1500));
        esp_restart();
    }

    vTaskDelete(NULL);

}

/*==========================================================
 * Public Functions
 *=========================================================*/

esp_err_t ota_manager_start(const char *url, const char *expected_sha256_hex, ota_status_callback_t callback){

    if((url == NULL) || (expected_sha256_hex == NULL) ||
       (strlen(url) >= OTA_URL_MAX) || (strlen(expected_sha256_hex) != 64))
        return ESP_ERR_INVALID_ARG;

    ota_task_args_t *args = malloc(sizeof(ota_task_args_t));
    if(args == NULL)
        return ESP_ERR_NO_MEM;

    strncpy(args->url, url, sizeof(args->url) - 1);
    args->url[sizeof(args->url) - 1] = '\0';

    strncpy(args->expected_sha256, expected_sha256_hex, sizeof(args->expected_sha256) - 1);
    args->expected_sha256[sizeof(args->expected_sha256) - 1] = '\0';

    args->callback = callback;

    if(xTaskCreate(ota_task, "ota_task", 8192, args, 5, NULL) != pdPASS){
        free(args);
        return ESP_FAIL;
    }

    return ESP_OK;

}

void ota_manager_confirm_valid(void){

    esp_ota_img_states_t state;
    const esp_partition_t *running = esp_ota_get_running_partition();

    if(esp_ota_get_state_partition(running, &state) != ESP_OK)
        return;

    if(state == ESP_OTA_IMG_PENDING_VERIFY){
        LOG_INFO(TAG, "Confirming current OTA image as valid");
        esp_ota_mark_app_valid_cancel_rollback();
    }

}