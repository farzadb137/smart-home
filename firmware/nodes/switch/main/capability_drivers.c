#include "capability_drivers.h"

#include "sensor_manager.h"
#include "logger.h"

#include "driver/gpio.h"

#define RELAY_GPIO 18

static const char *TAG = "RELAY";

/* GPIO_MODE_INPUT_OUTPUT (not plain OUTPUT) so we can read back the
 * level we're driving - relay_driver_read() below relies on that.
 * Pull-down so the relay defaults OFF on boot, before the first
 * command ever arrives, rather than floating into an unknown state. */
static esp_err_t relay_driver_init(void){

    gpio_config_t config = {
        .pin_bit_mask = (1ULL << RELAY_GPIO),
        .mode = GPIO_MODE_INPUT_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    esp_err_t err = gpio_config(&config);
    if(err != ESP_OK)
        return err;

    return gpio_set_level(RELAY_GPIO, 0);

}

static bool relay_driver_read(float *value){

    *value = gpio_get_level(RELAY_GPIO) ? 1.0f : 0.0f;

    return true;

}

static esp_err_t relay_driver_write(float value){

    LOG_INFO(TAG, "Setting relay %s", (value != 0.0f) ? "ON" : "OFF");

    return gpio_set_level(RELAY_GPIO, (value != 0.0f) ? 1 : 0);

}

static const capability_driver_t relay_driver = {
    .name = "switch",
    .type = CAP_TYPE_BINARY,
    .access = CAP_ACCESS_READ | CAP_ACCESS_WRITE,
    .init = relay_driver_init,
    .read = relay_driver_read,
    .write = relay_driver_write
};

void capability_drivers_register(void){

    sensor_manager_register(&relay_driver);

}