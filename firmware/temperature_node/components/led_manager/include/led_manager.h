#ifndef LED_MANAGER_H
#define LED_MANAGER_H

#include "esp_err.h"
#include <stdint.h>

typedef enum {
    LED_STATE_BOOT,
    LED_STATE_PROVISIONING,
    LED_STATE_WIFI_CONNECTING,
    LED_STATE_WIFI_CONNECTED,
    LED_STATE_MQTT_CONNECTING,
    LED_STATE_MQTT_CONNECTED,
    LED_STATE_ERROR
}led_state_t;

esp_err_t led_manager_init(void);

esp_err_t led_manager_set_state(led_state_t state);

#endif