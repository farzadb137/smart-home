#include "bsp.h"
#include "esp_log.h"

static const char *TAG = "BSP";

esp_err_t bsp_init(void)
{
    // rev-A: no power sequencing needed. Reserved for rev-B
    // (e.g. sensor power-gating, RF keepout, calibration).
    ESP_LOGI(TAG, "board=%s rev=%s target=%s", BSP_BOARD_ID, BSP_BOARD_REV, BSP_TARGET);
    return ESP_OK;
}
