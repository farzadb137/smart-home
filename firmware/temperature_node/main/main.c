#include <stdio.h>
#include "device_info.h"
#include "logger.h"
#include "system_info.h"
#include "wifi_manager.h"
#include "nvs_flash.h"

#define TAG "MAIN"

void app_main(void){

    esp_err_t ret = nvs_flash_init();

    if((ret == ESP_ERR_NVS_NO_FREE_PAGES) || (ret == ESP_ERR_NVS_NEW_VERSION_FOUND)){

        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
        
    }

    logger_init();

    device_info_init();

    system_info_init();

    wifi_manager_init();

    wifi_manager_start();

    LOG_INFO(TAG, "Application started");

}