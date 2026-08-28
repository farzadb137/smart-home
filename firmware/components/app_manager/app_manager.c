#include "app_manager.h"

#include "logger.h"
#include "telemetry_manager.h"
#include "status_manager.h"
#include "mqtt_manager.h"
#include "topic_manager.h"
#include "config_manager.h"
#include "telemetry_buffer.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "cJSON.h"

static const char *TAG = "APP";

/*==========================================================
 * Private Functions
 *=========================================================*/

static void telemetry_task(void *args){

    LOG_INFO(TAG, "Telemetry task started");

    telemetry_buffer_init();

    while(1){

        telemetry_t telemetry;
        telemetry_manager_get(&telemetry);

        if(!telemetry_buffer_push(&telemetry))
            LOG_WARN(TAG, "Telemetry buffer full - oldest buffered reading was dropped to make room");

        /* Drain as much of the buffer as we can while connected.
         * peek (don't remove) -> publish -> only pop on confirmed success,
         * so a disconnect mid-flush leaves the unsent reading in place
         * for the next cycle instead of losing it. */
        while(mqtt_manager_is_connected()){

            telemetry_t buffered;
            if(!telemetry_buffer_peek(&buffered))
                break;

            char *json = telemetry_manager_to_json(&buffered);
            if(json == NULL)
                break;

            LOG_INFO(TAG, "Publishing telemetry:\n%s", json);
            esp_err_t ret = mqtt_manager_publish(topic_manager_get_telemetry(), json, 1, false);

            cJSON_free(json);

            if(ret != ESP_OK){
                LOG_WARN(TAG, "Telemetry publish failed mid-flush, will retry next cycle");
                break;
            }

            telemetry_buffer_pop();

        }

        const app_config_t *config = config_manager_get();
        vTaskDelay(pdMS_TO_TICKS(config->telemetry_interval_sec * 1000));

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