#include "logger.h"
#include "config_manager.h"
#include "nvs_flash.h"
#include "device_info.h"
#include "system_info.h"
#include "sensor_manager.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "app_manager.h"

void app_main(void){

    // 1. Logging
    logger_init();

    esp_err_t ret = nvs_flash_init();
    if((ret == ESP_ERR_NVS_NO_FREE_PAGES) || (ret == ESP_ERR_NVS_NEW_VERSION_FOUND)){
        ESP_ERROR_CHECK(nvs_flash_erase());
        ESP_ERROR_CHECK(nvs_flash_init());
    }

    // 2. configuration
    config_manager_init();

    // 3. Static information
    device_info_init();

    // 4. System information
    system_info_init();

    // 5. Hardware
    sensor_manager_init();

    // 6. Network
    wifi_manager_init();

    // 7. Communication
    mqtt_manager_init();

    // 8. Application tasks
    app_manager_start();

}