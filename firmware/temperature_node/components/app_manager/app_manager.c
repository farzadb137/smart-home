#include "app_manager.h"

#include "logger.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "system_info.h"
#include "telemetry_manager.h"
#include "telemetry_serializer.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "topic_manager.h"
#include "cJSON.h"



static const char *TAG = "APP";

static void telemetry_task(void *args){

    LOG_INFO(TAG, "Telemetry task started");

    telemetry_t telemetry;

    while(1){

        telemetry_manager_get(&telemetry);

        char *json = telemetry_serializer_to_json(&telemetry);
        if(json != NULL){

            if(mqtt_manager_is_connected()){

                LOG_INFO(TAG, "Publishing telemetry:\n%s", json);
                esp_err_t ret = mqtt_manager_publish(topic_manager_get_telemetry(), json, 1, false);
                if(ret != ESP_OK)
                    LOG_WARN(TAG, "Telemetry publish failed");

            }

            cJSON_free(json);

        }

        vTaskDelay(pdMS_TO_TICKS(10000));

    }
}

static void status_task(void *args){

    LOG_INFO(TAG, "Status task started");

    while(1){

        cJSON *root = cJSON_CreateObject();

        const system_info_t *system = system_info_get();
        const wifi_status_t *wifi = wifi_manager_get_status();

        cJSON_AddBoolToObject(root, "online", true);
        cJSON_AddNumberToObject(root, "uptime", system->uptime_seconds);
        cJSON_AddBoolToObject(root, "wifi", wifi->state == WIFI_STATE_CONNECTED);
        cJSON_AddBoolToObject(root, "mqtt", mqtt_manager_is_connected());
        cJSON_AddNumberToObject(root, "rssi", wifi->rssi);

        char *json = cJSON_PrintUnformatted(root);
        if(json != NULL){

            if(mqtt_manager_is_connected()){

                LOG_INFO(TAG, "Publishing status:\n%s", json);
                esp_err_t ret = mqtt_manager_publish(topic_manager_get_status(), json, 1, true);
                if(ret != ESP_OK)
                    LOG_WARN(TAG, "Telemetry publish failed");
                
            }

            cJSON_free(json);
        }

        cJSON_Delete(root);

        vTaskDelay(pdMS_TO_TICKS(30000));

    }
}


void app_manager_start(void){

    xTaskCreate(telemetry_task, "telemetry_task", 4096, NULL, 5, NULL);

    xTaskCreate(status_task, "status_task", 4096, NULL, 5, NULL);

}