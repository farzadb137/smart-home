#pragma once
/* Smart Door Sensor — BSP rev-A. ESP32-C6-WROOM-1 + reed switch. */
#include "esp_err.h"
#ifdef __cplusplus
extern "C" {
#endif
#define BSP_BOARD_ID "smart-door-sensor"
#define BSP_BOARD_REV "A"
#define BSP_TARGET "esp32c6"
/* Reed NO between GPIO and GND, internal pull-up. 1=OPEN (magnet away), 0=CLOSED (magnet near).
 * If HW uses NC reed, flip ternary in contact_driver_read() once confirmed on hardware. */
#define BSP_CONTACT_GPIO 18
#define BSP_BUTTON_GPIO 20
#define BSP_LED_GPIO 8
#define BSP_LED_COUNT 1
#define BSP_POWER_BATTERY 1
esp_err_t bsp_init(void);
#ifdef __cplusplus
}
#endif
