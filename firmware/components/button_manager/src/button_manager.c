#include "button_manager.h"

#include "logger.h"
#include "config_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "esp_system.h"

#define BUTTON_PRESSED_THRESHOLD    5000

static const char *TAG = "BUTTON";

static int s_button_gpio = -1;

static void button_task(void *args){

    uint8_t last_state = 1;
    uint8_t current_state;
    uint32_t start_time = 0;

    while(1){

        current_state = gpio_get_level(s_button_gpio);
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

esp_err_t button_manager_init(int gpio_num){

    if(gpio_num < 0 || gpio_num >= GPIO_NUM_MAX){
        LOG_ERROR(TAG, "invalid button gpio %d", gpio_num);
        return ESP_ERR_INVALID_ARG;
    }

    s_button_gpio = gpio_num;

    gpio_config_t button_config = {
        .pin_bit_mask = (1ULL << s_button_gpio),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    gpio_config(&button_config);

    LOG_INFO(TAG, "Starting button task on GPIO %d", s_button_gpio);

    xTaskCreate(button_task, "button_task", 2048, NULL, 10, NULL);

    return ESP_OK;
}