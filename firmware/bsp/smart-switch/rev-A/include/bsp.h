#pragma once

/* Smart Switch — Board Support Package, rev-A
 * Single source of truth for ALL board-specific pins.
 * App code must use BSP_* defines, never raw GPIO numbers.
 *
 * Board: ESP32-C6-WROOM-1 + relay output.
 * Matches: devices/smart-switch (rev A), hardware/boards/smart-switch
 * Power: MAINS — isolation / creepage / fuse / varistor review required
 * before pilot (see hardware notes). Firmware cannot fix layout.
 */

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BSP_BOARD_ID "smart-switch"
#define BSP_BOARD_REV "A"
#define BSP_TARGET "esp32c6"

/* Relay drive: HIGH = ON, LOW = OFF. Default OFF at boot.
 * Driver must use GPIO_MODE_INPUT_OUTPUT (not plain OUTPUT) so
 * relay_driver_read() can read back the level, with pull-down
 * so the relay defaults OFF before the first command arrives. */
#define BSP_RELAY_GPIO 18

/* Shared UI — must match button_manager.c (GPIO20) and led_manager.c (GPIO8/WS2812x1)
 * until B-full moves those managers to init-args. */
#define BSP_BUTTON_GPIO 20
#define BSP_LED_GPIO 8
#define BSP_LED_COUNT 1

#define BSP_POWER_MAINS 1

esp_err_t bsp_init(void);

#ifdef __cplusplus
}
#endif
