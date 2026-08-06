#include "config_manager.h"

#include "logger.h"

#include <string.h>


static const char *TAG = "CONFIG";

static app_config_t config;


esp_err_t config_manager_init(void){

    memset(&config, 0, sizeof(config));

    strcpy(config.wifi_ssid, "TP-LINK_FHB");
    strcpy(config.wifi_password, "12402055");
    strcpy(config.mqtt_uri, "mqtt://192.168.1.100");
    strcpy(config.device_name, "TEMP-LIVING-0001");

    LOG_INFO(TAG, "Configuration loaded");

    return ESP_OK;
}



const app_config_t *config_manager_get(void){

    return &config;
}