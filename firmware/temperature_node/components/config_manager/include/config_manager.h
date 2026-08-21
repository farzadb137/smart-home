#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include "esp_err.h"
#include <stdbool.h>


typedef struct{
    bool provisioned;
    char wifi_ssid[32];
    char wifi_password[64];
    char mqtt_uri[128];
    char device_name[32];
}app_config_t;


esp_err_t config_manager_init(void);
const app_config_t *config_manager_get(void);
esp_err_t config_manager_save(void);
esp_err_t config_manager_update_device_name(const char *device_name);
esp_err_t config_manager_update_mqtt_uri(const char *uri);
esp_err_t config_manager_update_wifi_credentials(const char *ssid, const char *password);
esp_err_t config_manager_mark_provisioned(void);
esp_err_t config_manager_factory_reset(void);
bool config_manager_is_provisioned(void);


#endif