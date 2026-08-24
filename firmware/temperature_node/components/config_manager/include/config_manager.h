#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>


typedef struct{
    bool provisioned;
    char wifi_ssid[32];
    char wifi_password[64];
    char mqtt_uri[128];
    char mqtt_username[32];
    char mqtt_password[48];
    char device_name[32];
    uint32_t telemetry_interval_sec;
    char ap_password[16];
}app_config_t;


esp_err_t config_manager_init(void);
const app_config_t *config_manager_get(void);
esp_err_t config_manager_save(void);
esp_err_t config_manager_update_device_name(const char *device_name);
esp_err_t config_manager_update_mqtt_uri(const char *uri);
esp_err_t config_manager_update_wifi_credentials(const char *ssid, const char *password);
esp_err_t config_manager_update_mqtt_credentials(const char *username, const char *password);
esp_err_t config_manager_update_telemetry_interval(uint32_t interval_sec);
esp_err_t config_manager_update_ap_password(const char *password);
esp_err_t config_manager_mark_provisioned(void);
esp_err_t config_manager_factory_reset(void);
bool config_manager_is_provisioned(void);


#endif