#include "button_manager.h"

#include "logger.h"
#include "config_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "esp_system.h"

#define BUTTON_PIN GPIO_NUM_20

#define BUTTON_PRESSED_THRESHOLD    5000

static const char *TAG = "BUTTON";

static void button_task(void *args){

    uint8_t last_state = 1;
    uint8_t current_state;
    uint32_t start_time = 0;

    while(1){

        current_state = gpio_get_level(BUTTON_PIN);
        if((current_state != last_state) && (current_state == 0))
            start_time = esp_timer_get_time() / 1000;
        else if((current_state == last_state) && (current_state == 0)){
            if(((esp_timer_get_time() / 1000) - start_time) > BUTTON_PRESSED_THRESHOLD){
                if(config_manager_factory_reset() == ESP_OK){
                    LOG_ERROR(TAG, "factory reset is Done Restarting");
                    vTaskDelay(pdMS_TO_TICKS(500));
                    esp_restart();
                }
                else
                    LOG_ERROR(TAG, "factory reset failed! can not save config on NVS");
            }
        }

        last_state = current_state;

        vTaskDelay(pdMS_TO_TICKS(50));

    }

}

esp_err_t button_manager_init(void){

    gpio_config_t button_config = {
        .pin_bit_mask = (1ULL << BUTTON_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    gpio_config(&button_config);

    LOG_INFO(TAG, "Starting button task");

    xTaskCreate(button_task, "button_task", 2048, NULL, 10, NULL);

    return ESP_OK;
}