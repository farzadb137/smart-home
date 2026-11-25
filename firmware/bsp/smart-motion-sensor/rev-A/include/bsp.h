#pragma once
/* Smart Motion Sensor — BSP rev-A PLACEHOLDER. No firmware/app exists yet.
 * TODO: confirm PIR part + lens + GPIO from hardware/boards/smart-motion-sensor schematics,
 * then replace BSP_PIR_GPIO below. Button/LED match other boards for now. */
#include "esp_err.h"
#ifdef __cplusplus
extern "C" {
#endif
#define BSP_BOARD_ID "smart-motion-sensor"
#define BSP_BOARD_REV "A"
#define BSP_TARGET "esp32c6"
/* TODO: verify against MCU.SchDoc — provisional value, DO NOT BUILD against it. */
#define BSP_PIR_GPIO 18
#define BSP_BUTTON_GPIO 20
#define BSP_LED_GPIO 8
#define BSP_LED_COUNT 1
esp_err_t bsp_init(void);
#ifdef __cplusplus
}
#endif
