#include "config_manager.h"

#include "logger.h"

#include "nvs_flash.h"
#include "nvs.h"

#include <string.h>


static const char *TAG = "CONFIG";

static app_config_t config;
static const char *NVS_NAMESPACE = "config";
static const char *NVS_KEY = "app_config";

/*==========================================================
 * Private Functions
 *=========================================================*/

static void config_set_defaults(void){

    memset(&config, 0, sizeof(config));

    strcpy(config.wifi_ssid, "TP-LINK_FHB");
    strcpy(config.wifi_password, "12402055");
    strcpy(config.mqtt_uri, "mqtt://192.168.1.160");
    strcpy(config.device_name, "TEMP-LIVING-0001");

}

static esp_err_t config_save_internal(nvs_handle_t handle){

    esp_err_t err = nvs_set_blob(handle, NVS_KEY, &config, sizeof(config));
    if(err != ESP_OK)
        return err;

    return nvs_commit(handle);
}

/*==========================================================
 * Public Functions
 *=========================================================*/

esp_err_t config_manager_init(void){

    esp_err_t err = nvs_flash_init();
    if((err == ESP_ERR_NVS_NO_FREE_PAGES) || (err == ESP_ERR_NVS_NEW_VERSION_FOUND)){
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    if(err != ESP_OK)
        return err;

    nvs_handle_t handle;
    err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle);
    if(err != ESP_OK)
        return err;

    size_t size = sizeof(config);
    err = nvs_get_blob(handle, NVS_KEY, &config, &size);
    if(err == ESP_ERR_NVS_NOT_FOUND){
        
        config_set_defaults();

        err = config_save_internal(handle);
        if(err != ESP_OK){
            nvs_close(handle);
            return err;
        }

        LOG_INFO(TAG, "Default configuration created");
    }
    else if(err == ESP_OK)
        LOG_INFO(TAG, "Configuration loaded from NVS");
    else{
        LOG_ERROR(TAG, "Failed to load configuration (%s)", esp_err_to_name(err));

        nvs_close(handle);
        return err;
    }

    nvs_close(handle);

    return ESP_OK;
}

const app_config_t *config_manager_get(void){

    return &config;
}

esp_err_t config_manager_save(void){

    nvs_handle_t handle;

    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle);
    if(err != ESP_OK)
        return err;

    err = config_save_internal(handle);

    nvs_close(handle);

    return err;
}

esp_err_t config_manager_update_device_name(const char *device_name){

    if(device_name == NULL)
        return ESP_ERR_INVALID_ARG;

    strncpy(config.device_name, device_name, sizeof(config.device_name) - 1);

    config.device_name[sizeof(config.device_name) - 1] = '\0';

    return config_manager_save();
}

esp_err_t config_manager_update_mqtt_uri(const char *uri){

    if(uri == NULL)
        return ESP_ERR_INVALID_ARG;

    strncpy(config.mqtt_uri, uri, sizeof(config.mqtt_uri) - 1);

    config.mqtt_uri[sizeof(config.mqtt_uri) - 1] = '\0';

    return config_manager_save();
}