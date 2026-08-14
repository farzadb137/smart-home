#include "app_manager.h"

#include "logger.h"
#include "telemetry_manager.h"
#include "status_manager.h"
#include "mqtt_manager.h"
#include "topic_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "cJSON.h"

static const char *TAG = "APP";

/*==========================================================
 * Private Functions
 *=========================================================*/

static void telemetry_task(void *args){

    LOG_INFO(TAG, "Telemetry task started");

    telemetry_t telemetry;

    while(1){

        telemetry_manager_get(&telemetry);

        char *json = telemetry_manager_to_json(&telemetry);
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

    status_t status;

    while(1){

        status_manager_get(&status);

        char *json = status_manager_to_json(&status);
        if(json != NULL){

            if(mqtt_manager_is_connected()){

                LOG_INFO(TAG, "Publishing status:\n%s", json);
                esp_err_t ret = mqtt_manager_publish(topic_manager_get_status(), json, 1, true);
                if(ret != ESP_OK)
                    LOG_WARN(TAG, "Status publish failed");

            }

            cJSON_free(json);

        }

        vTaskDelay(pdMS_TO_TICKS(11000));

    }
}

/*==========================================================
 * Public Functions
 *=========================================================*/

void app_manager_start(void){

    xTaskCreate(telemetry_task, "telemetry_task", 4096, NULL, 5, NULL);

    xTaskCreate(status_task, "status_task", 4096, NULL, 5, NULL);

}