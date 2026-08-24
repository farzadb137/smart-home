#include "config_manager.h"

#include "logger.h"

#include "nvs_flash.h"
#include "nvs.h"
#include <string.h>

#define APP_CONFIG_VERSION  1
#define APP_CONFIG_MAGIC UINT32_C(0x3D593E4B)

#define TELEMETRY_INTERVAL_MIN_SEC   5
#define TELEMETRY_INTERVAL_MAX_SEC   3600

typedef struct{
    uint32_t magic;
    uint32_t version;
    app_config_t config;
}app_config_storage_t;


static const char *TAG = "CONFIG";

static const char *NVS_NAMESPACE = "config";
static const char *NVS_KEY = "app_config";

static app_config_storage_t config_storage;

/*==========================================================
 * Private Functions
 *=========================================================*/

 static esp_err_t config_save_internal(nvs_handle_t handle){

    esp_err_t err = nvs_set_blob(handle, NVS_KEY, &config_storage, sizeof(config_storage));
    if(err != ESP_OK)
        return err;

    return nvs_commit(handle);
}

static void config_set_defaults(void){

    memset(&config_storage, 0, sizeof(config_storage));

    config_storage.magic = APP_CONFIG_MAGIC;
    config_storage.version = APP_CONFIG_VERSION;

    strcpy(config_storage.config.device_name, "TEMP-DEFAULT-0002");

    config_storage.config.telemetry_interval_sec = 10;

}

/*==========================================================
 * Public Functions
 *=========================================================*/

esp_err_t config_manager_init(void){

    esp_err_t err = nvs_flash_init();
    if((err == ESP_ERR_NVS_NO_FREE_PAGES) || (err == ESP_ERR_NVS_NEW_VERSION_FOUND)){
        err = nvs_flash_erase();
        if(err != ESP_OK)
            return err;
        err = nvs_flash_init();
    }
    if(err != ESP_OK)
        return err;

    nvs_handle_t handle;
    err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle);
    if(err != ESP_OK)
        return err;

    size_t size = sizeof(config_storage);
    err = nvs_get_blob(handle, NVS_KEY, &config_storage, &size);
    if((err == ESP_ERR_NVS_NOT_FOUND) || (err == ESP_ERR_NVS_INVALID_LENGTH) || 
        ((err == ESP_OK) && ((size != sizeof(config_storage)) || (config_storage.magic != APP_CONFIG_MAGIC) || (config_storage.version != APP_CONFIG_VERSION)))){
        
        LOG_INFO(TAG, "Creating default configuration");

        config_set_defaults();

        err = config_save_internal(handle);
        if(err != ESP_OK){
            nvs_close(handle);
            return err;
        }

    }
    else if(err == ESP_OK){
        LOG_INFO(TAG, "Configuration loaded from NVS Version: %d", config_storage.version);
    }
    else{
        LOG_ERROR(TAG, "Failed to load configuration (%s)", esp_err_to_name(err));

        nvs_close(handle);
        return err;
    }

    nvs_close(handle);

    return ESP_OK;
}

const app_config_t *config_manager_get(void){

    return &config_storage.config;
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

    char name[sizeof(config_storage.config.device_name)];
    strncpy(name, config_storage.config.device_name, sizeof(name) - 1);
    name[sizeof(name) - 1] = '\0';

    strncpy(config_storage.config.device_name, device_name, sizeof(config_storage.config.device_name) - 1);
    config_storage.config.device_name[sizeof(config_storage.config.device_name) - 1] = '\0';

    esp_err_t err = config_manager_save();
    if(err != ESP_OK)
        memcpy(config_storage.config.device_name, name, sizeof(name));

    return err;
}

esp_err_t config_manager_update_mqtt_uri(const char *uri){

    if(uri == NULL)
        return ESP_ERR_INVALID_ARG;

    char old_uri[sizeof(config_storage.config.mqtt_uri)];
    strncpy(old_uri, config_storage.config.mqtt_uri, sizeof(old_uri) - 1);
    old_uri[sizeof(old_uri) - 1] = '\0';

    strncpy(config_storage.config.mqtt_uri, uri, sizeof(config_storage.config.mqtt_uri) - 1);
    config_storage.config.mqtt_uri[sizeof(config_storage.config.mqtt_uri) - 1] = '\0';

    esp_err_t err = config_manager_save();
    if(err != ESP_OK)
        memcpy(config_storage.config.mqtt_uri, old_uri, sizeof(old_uri));

    return err;
}

esp_err_t config_manager_update_wifi_credentials(const char *ssid, const char *password){

    if((ssid == NULL) || (password == NULL))
        return ESP_ERR_INVALID_ARG;

    char old_ssid[sizeof(config_storage.config.wifi_ssid)];
    strncpy(old_ssid, config_storage.config.wifi_ssid, sizeof(old_ssid) - 1);
    old_ssid[sizeof(old_ssid) - 1] = '\0';

    char old_password[sizeof(config_storage.config.wifi_password)];
    strncpy(old_password, config_storage.config.wifi_password, sizeof(old_password) - 1);
    old_password[sizeof(old_password) - 1] = '\0';

    strncpy(config_storage.config.wifi_ssid, ssid, sizeof(config_storage.config.wifi_ssid) - 1);
    config_storage.config.wifi_ssid[sizeof(config_storage.config.wifi_ssid) - 1] = '\0';

    strncpy(config_storage.config.wifi_password, password, sizeof(config_storage.config.wifi_password) - 1);
    config_storage.config.wifi_password[sizeof(config_storage.config.wifi_password) - 1] = '\0';

    esp_err_t err = config_manager_save();
    if(err != ESP_OK){
        memcpy(config_storage.config.wifi_ssid, old_ssid, sizeof(old_ssid));
        memcpy(config_storage.config.wifi_password, old_password, sizeof(old_password));
    }

    return err;
}

esp_err_t config_manager_update_mqtt_credentials(const char *username, const char *password){

    if((username == NULL) || (password == NULL))
        return ESP_ERR_INVALID_ARG;

    char old_username[sizeof(config_storage.config.mqtt_username)];
    strncpy(old_username, config_storage.config.mqtt_username, sizeof(old_username) - 1);
    old_username[sizeof(old_username) - 1] = '\0';

    char old_password[sizeof(config_storage.config.mqtt_password)];
    strncpy(old_password, config_storage.config.mqtt_password, sizeof(old_password) - 1);
    old_password[sizeof(old_password) - 1] = '\0';

    strncpy(config_storage.config.mqtt_username, username, sizeof(config_storage.config.mqtt_username) - 1);
    config_storage.config.mqtt_username[sizeof(config_storage.config.mqtt_username) - 1] = '\0';

    strncpy(config_storage.config.mqtt_password, password, sizeof(config_storage.config.mqtt_password) - 1);
    config_storage.config.mqtt_password[sizeof(config_storage.config.mqtt_password) - 1] = '\0';

    esp_err_t err = config_manager_save();
    if(err != ESP_OK){
        memcpy(config_storage.config.mqtt_username, old_username, sizeof(old_username));
        memcpy(config_storage.config.mqtt_password, old_password, sizeof(old_password));
    }

    return err;
}

esp_err_t config_manager_update_telemetry_interval(uint32_t interval_sec){
 
    if((interval_sec < TELEMETRY_INTERVAL_MIN_SEC) || (interval_sec > TELEMETRY_INTERVAL_MAX_SEC))
        return ESP_ERR_INVALID_ARG;
 
    uint32_t old_interval = config_storage.config.telemetry_interval_sec;
 
    config_storage.config.telemetry_interval_sec = interval_sec;
 
    esp_err_t err = config_manager_save();
    if(err != ESP_OK)
        config_storage.config.telemetry_interval_sec = old_interval;
 
    return err;
}

esp_err_t config_manager_mark_provisioned(void){

    config_storage.config.provisioned = true;

    return config_manager_save();
}

esp_err_t config_manager_factory_reset(void){

    config_set_defaults();

    return config_manager_save();
}

bool config_manager_is_provisioned(void){

    return config_storage.config.provisioned;
}