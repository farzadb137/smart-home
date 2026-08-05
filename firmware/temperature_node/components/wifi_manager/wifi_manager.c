#include "wifi_manager.h"

#include "wifi_config.h"

#include "logger.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"

#include <string.h>

static wifi_status_t wifi_status;
static EventGroupHandle_t wifi_event_group;
static const char *TAG = "WIFI";

static TaskHandle_t wifi_task_handle = NULL;

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);

static void wifi_task(void *arg);

void wifi_manager_init(void){

    wifi_event_group = xEventGroupCreate();

    memset(&wifi_status, 0, sizeof(wifi_status));
    strcpy(wifi_status.ssid, WIFI_SSID);

    esp_netif_init();

    esp_event_loop_create_default();

    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();

    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    LOG_INFO(TAG, "WiFi initialized");

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler, NULL));

    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL));

}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data){

    if(event_base == WIFI_EVENT){
        switch(event_id){
            case WIFI_EVENT_STA_START:
                LOG_INFO(TAG, "WiFi started");
                wifi_status.state = WIFI_STATE_CONNECTING;
                esp_wifi_connect();
                break;
            case WIFI_EVENT_STA_DISCONNECTED:
                LOG_WARN(TAG, "Disconnected");
                wifi_status.state = WIFI_STATE_DISCONNECTED;
                xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);
                break;
        }
    }
    else if((event_base == IP_EVENT) && (event_id == IP_EVENT_STA_GOT_IP)){
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        wifi_status.state = WIFI_STATE_CONNECTED;
        snprintf(wifi_status.ip, sizeof(wifi_status.ip), IPSTR, IP2STR(&event->ip_info.ip));
        xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
        LOG_INFO(TAG, "Got IP: %s", wifi_status.ip);
    }

}

static void wifi_task(void *arg){

    uint32_t retry_delay = WIFI_RETRY_INITIAL_DELAY_MS;

    while(1){

        EventBits_t bits = xEventGroupGetBits(wifi_event_group);
        if(!(bits & WIFI_CONNECTED_BIT)){

            LOG_INFO(TAG, "Attempting WiFi connection");

            esp_wifi_connect();

            vTaskDelay(pdMS_TO_TICKS(retry_delay));
            retry_delay *= 2;

            if(retry_delay > WIFI_RETRY_MAX_DELAY_MS)
                retry_delay = WIFI_RETRY_MAX_DELAY_MS;

        }
        else{

            retry_delay = WIFI_RETRY_INITIAL_DELAY_MS;
            vTaskDelay(pdMS_TO_TICKS(10000));

        }
    }
}

void wifi_manager_start(void){

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASSWORD
        }
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    xTaskCreate(wifi_task, "wifi_task", 4096, NULL, 5, &wifi_task_handle);
    
}