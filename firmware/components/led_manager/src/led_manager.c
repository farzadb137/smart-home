#include "led_manager.h"

#include "logger.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "led_strip.h"
#include "led_strip_rmt.h"

#define LED_GPIO        8
#define LED_COUNT       1

static const char *TAG = "LED";

static led_strip_handle_t led_strip = NULL;

static led_state_t current_state = LED_STATE_BOOT;
static TaskHandle_t led_task_handle = NULL;

/*==========================================================
 * Private Functions
 *=========================================================*/

 static esp_err_t led_manager_set_color(uint8_t red, uint8_t green, uint8_t blue){

    if(led_strip == NULL)
        return ESP_ERR_INVALID_STATE;

    esp_err_t err = led_strip_set_pixel(led_strip, 0, red, green, blue);

    if(err != ESP_OK)
        return err;

    return led_strip_refresh(led_strip);
}

static esp_err_t led_manager_off(void){

    if(led_strip == NULL)
        return ESP_ERR_INVALID_STATE;

    return led_strip_clear(led_strip);
}

static void led_task(void *arg){

    bool blinking = false;

    while(1){

        led_state_t state = current_state;

        switch(state){
            case LED_STATE_WIFI_CONNECTING:
                if(blinking)
                    led_manager_set_color(0, 0, 255);
                else
                    led_manager_off();
                blinking = !blinking;
                vTaskDelay(pdMS_TO_TICKS(500));
                break;
            case LED_STATE_PROVISIONING:
                if(blinking)
                    led_manager_set_color(0, 255, 255);
                else
                    led_manager_off();
                blinking = !blinking;
                vTaskDelay(pdMS_TO_TICKS(500));
                break;
            case LED_STATE_MQTT_CONNECTING:
                if(blinking)
                    led_manager_set_color(255, 180, 0);
                else
                    led_manager_off();
                blinking = !blinking;
                vTaskDelay(pdMS_TO_TICKS(500));
                break;
            case LED_STATE_ERROR:
                if(blinking)
                    led_manager_set_color(255, 0, 0);
                else
                    led_manager_off();
                blinking = !blinking;
                vTaskDelay(pdMS_TO_TICKS(500));
                break;
            case LED_STATE_BOOT:
                led_manager_set_color(255, 255, 255);
                blinking = false;
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
            case LED_STATE_WIFI_CONNECTED:
                led_manager_set_color(255, 180, 0);
                blinking = false;
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
            case LED_STATE_MQTT_CONNECTED:
                led_manager_set_color(0, 255, 0);
                blinking = false;
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
            default:
                led_manager_off();
                blinking = false;
                vTaskDelay(pdMS_TO_TICKS(100));
                break;
        }
    }
}

/*==========================================================
 * Public Functions
 *=========================================================*/

esp_err_t led_manager_init(void){

    led_strip_config_t strip_config = {
        .strip_gpio_num = LED_GPIO,
        .max_leds = LED_COUNT,
        .led_model = LED_MODEL_WS2812,
        .color_component_format = LED_STRIP_COLOR_COMPONENT_FMT_GRB,
        .flags.invert_out = false,
    };

    led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000,
        .mem_block_symbols = 0,
        .flags.with_dma = false,
    };

    esp_err_t err = led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip);

    if(err != ESP_OK){
        LOG_ERROR(TAG, "Failed to initialize RGB LED: %s", esp_err_to_name(err));
        return err;
    }

    err = led_manager_off();
    if(err != ESP_OK)
        return err;

    BaseType_t result = xTaskCreate(led_task, "led_task", 2048, NULL, 5, &led_task_handle);

    if(result != pdPASS){
        LOG_ERROR(TAG, "Failed to create LED task");
        return ESP_FAIL;
    }

    LOG_INFO(TAG, "RGB LED initialized");

    return ESP_OK;
}

esp_err_t led_manager_set_state(led_state_t state){
    if((state < LED_STATE_BOOT) || (state > LED_STATE_ERROR))
        return ESP_ERR_INVALID_ARG;

    current_state = state;

    return ESP_OK;
}



