#pragma once

/* Smart Temp Sensor — Board Support Package, rev-A
 * Single source of truth for ALL board-specific pins.
 * App code must use BSP_* defines, never raw GPIO numbers.
 *
 * Board: ESP32-C6-WROOM-1, DS18B20 on 1-Wire.
 * Matches: devices/smart-temp-sensor (rev A), hardware/boards/smart-temp-sensor
 */

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BSP_BOARD_ID "smart-temp-sensor"
#define BSP_BOARD_REV "A"
#define BSP_TARGET "esp32c6"

/* DS18B20 data line (1-Wire). External 4.7k pull-up to 3V3 required.
 * Parasite power NOT supported on rev-A — sensor must be powered. */
#define BSP_TEMP_GPIO 18

/* Shared UI — must match button_manager.c (GPIO20) and led_manager.c (GPIO8/WS2812x1)
 * until B-full moves those managers to init-args. Documented here so rev-B
 * changes both places together. */
#define BSP_BUTTON_GPIO 20
#define BSP_LED_GPIO 8
#define BSP_LED_COUNT 1

/* Early board init: power rails, strapping pins, future RF/calibration.
 * Currently a stub returning ESP_OK — call it first in app_main() to
 * reserve the ordering for rev-B (where it will do real work). */
esp_err_t bsp_init(void);

#ifdef __cplusplus
}
#endif
