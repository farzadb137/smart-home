#include "sensor_manager.h"

#include "ds18b20.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_log.h"


#define SENSOR_GPIO 18
#define SENSOR_PERIOD_MS 5000

static sensor_data_t sensor_data;
static TaskHandle_t sensor_task_handle;

static const char *TAG = "SENSOR";

void sensor_manager_init(void){

    sensor_data.temperature = 0;
    sensor_data.timestamp = 0;
    sensor_data.valid = false;

    ds18b20_init(SENSOR_GPIO);

    ESP_LOGI(TAG, "Sensor manager initialized");

}

static void sensor_task(void *arg){

    while(1){

        float temperature;
        bool result = ds18b20_read_temperature(&temperature);

        if(result){

            sensor_data.temperature = temperature;
            sensor_data.timestamp = xTaskGetTickCount() / configTICK_RATE_HZ;
            sensor_data.valid = true;

            ESP_LOGI(TAG, "Temperature %.2f C", temperature);
        }
        else{

            sensor_data.valid = false;

            ESP_LOGW(TAG, "Sensor read failed");
        }


        vTaskDelay(pdMS_TO_TICKS(SENSOR_PERIOD_MS));

    }
}

void sensor_manager_start(void){
    
    xTaskCreate(
        sensor_task,
        "sensor_task",
        4096,
        NULL,
        5,
        &sensor_task_handle
    );

}

const sensor_data_t *sensor_manager_get_data(void){
    
    return &sensor_data;
}