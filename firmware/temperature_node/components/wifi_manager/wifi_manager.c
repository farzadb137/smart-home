#include "wifi_manager.h"

#include "led_manager.h"
#include "logger.h"
#include "config_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"

#include <string.h>


#define WIFI_CONNECTED_BIT BIT0

#define WIFI_RETRY_INITIAL_DELAY_MS 5000
#define WIFI_RETRY_MAX_DELAY_MS 60000

static wifi_status_t wifi_status;
static EventGroupHandle_t wifi_event_group;
static TaskHandle_t wifi_task_handle = NULL;

static const char *TAG = "WIFI";

/*==========================================================
 * Private Functions
 *=========================================================*/

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data){

    if(event_base == WIFI_EVENT){
        switch(event_id){
            case WIFI_EVENT_STA_START:
                LOG_INFO(TAG, "WiFi started");
                wifi_status.state = WIFI_STATE_CONNECTING;
                esp_wifi_connect();
                break;
            case WIFI_EVENT_STA_DISCONNECTED:
                led_manager_set_state(LED_STATE_WIFI_CONNECTING);
                LOG_WARN(TAG, "Disconnected");
                wifi_status.state = WIFI_STATE_DISCONNECTED;
                wifi_status.rssi = 0;
                xEventGroupClearBits(wifi_event_group, WIFI_CONNECTED_BIT);
                break;
            default:
                break;
        }
    }
    else if((event_base == IP_EVENT) && (event_id == IP_EVENT_STA_GOT_IP)){
        ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
        wifi_status.state = WIFI_STATE_CONNECTED;
        led_manager_set_state(LED_STATE_WIFI_CONNECTED);
        wifi_ap_record_t ap_info;
        if(esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK)
            wifi_status.rssi = ap_info.rssi;
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
            wifi_ap_record_t ap_info;
            if(esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK)
                wifi_status.rssi = ap_info.rssi;
            vTaskDelay(pdMS_TO_TICKS(10000));
        }
    }
}

/*==========================================================
 * Public Functions
 *=========================================================*/

void wifi_manager_init(void){

    wifi_event_group = xEventGroupCreate();
    const app_config_t *config = config_manager_get();

    memset(&wifi_status, 0, sizeof(wifi_status));
    strcpy(wifi_status.ssid, config->wifi_ssid);

    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    LOG_INFO(TAG, "WiFi initialized");

    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, wifi_event_handler, NULL));

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    
    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, config->wifi_ssid, sizeof(wifi_config.sta.ssid) - 1);
    strncpy((char *)wifi_config.sta.password, config->wifi_password, sizeof(wifi_config.sta.password) - 1);

    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    ESP_ERROR_CHECK(esp_wifi_start());

    led_manager_set_state(LED_STATE_WIFI_CONNECTING);

    xTaskCreate(wifi_task, "wifi_task", 4096, NULL, 5, &wifi_task_handle);

}

const wifi_status_t *wifi_manager_get_status(void){
    
    return &wifi_status;
}
