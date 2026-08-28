#include "command_manager.h"

#include "logger.h"
#include "config_manager.h"
#include "status_manager.h"
#include "telemetry_manager.h"
#include "ota_manager.h"
#include "device_info.h"
#include "sensor_manager.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_system.h"
#include "cJSON.h"

#include <string.h>


typedef void (*command_handler_t)(cJSON *root);

typedef struct{
    const char *name;
    command_handler_t handler;
}command_entry_t;

static const char *TAG = "COMMAND";

static command_response_callback_t response_callback = NULL;

static void handle_get_config(cJSON *root);
static void handle_get_status(cJSON *root);
static void handle_get_telemetry(cJSON *root);
static void handle_set_config(cJSON *root);
static void handle_set_capability(cJSON *root);
static void handle_restart(cJSON *root);
static void handle_ota_update(cJSON *root);



static const command_entry_t command_table[] = {
    { "get_config",     handle_get_config       },
    { "get_status",     handle_get_status       },
    { "get_telemetry",  handle_get_telemetry    },
    { "set_config",     handle_set_config       },
    { "set_capability", handle_set_capability   },
    { "restart",        handle_restart          },
    { "ota_update",     handle_ota_update       },
    
};

#define COMMAND_COUNT (sizeof(command_table) / sizeof(command_table[0]))

/*==========================================================
 * Private Functions
 *=========================================================*/

 static void send_response(cJSON *response){

    if(response_callback == NULL)
        return;

    char *json = cJSON_PrintUnformatted(response);
    response_callback(json);
    cJSON_free(json);

}

 static void handle_get_config(cJSON *root){

    const app_config_t *config = config_manager_get();

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddStringToObject(data, "device_name", config->device_name);
    cJSON_AddNumberToObject(data, "telemetry_interval_sec", config->telemetry_interval_sec);

    send_response(response);

    cJSON_Delete(response);

 }

 static void handle_set_capability(cJSON *root){

    cJSON *data = cJSON_GetObjectItem(root, "data");
    cJSON *name = cJSON_GetObjectItem(data, "name");
    cJSON *value = cJSON_GetObjectItem(data, "value");

    if((name == NULL) || !cJSON_IsString(name) || (value == NULL) || !cJSON_IsNumber(value)){
        cJSON *response = cJSON_CreateObject();
        cJSON_AddBoolToObject(response, "success", false);
        cJSON_AddStringToObject(response, "error", "set_capability requires 'name' and 'value'");
        send_response(response);
        cJSON_Delete(response);
        return;
    }

    esp_err_t err = sensor_manager_set_capability(name->valuestring, (float)value->valuedouble);

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", err == ESP_OK);

    if(err == ESP_OK){
        cJSON *response_data = cJSON_AddObjectToObject(response, "data");
        cJSON_AddStringToObject(response_data, "name", name->valuestring);
        cJSON_AddNumberToObject(response_data, "value", value->valuedouble);
    }
    else{
        const char *reason = (err == ESP_ERR_NOT_FOUND)     ? "Unknown capability" :
                              (err == ESP_ERR_NOT_SUPPORTED) ? "Capability is not writable" :
                                                                "Failed to set capability";
        cJSON_AddStringToObject(response, "error", reason);
    }

    send_response(response);

    cJSON_Delete(response);

}

static void handle_get_status(cJSON *root){

    status_t status;
    status_manager_get(&status);

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddNumberToObject(data, "uptime", status.uptime);
    cJSON_AddBoolToObject(data, "wifi", status.wifi_is_connected);
    cJSON_AddNumberToObject(data, "rssi", status.rssi);
    cJSON_AddBoolToObject(data, "mqtt", status.mqtt_is_connected);

    send_response(response);

    cJSON_Delete(response);

}

static void handle_get_telemetry(cJSON *root){

    telemetry_t telemetry;
    telemetry_manager_get(&telemetry);

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *data = cJSON_AddObjectToObject(response, "data");

    cJSON *device = cJSON_AddObjectToObject(data, "device");
    cJSON *system = cJSON_AddObjectToObject(data, "system");
    cJSON *capabilities = cJSON_AddObjectToObject(data, "capabilities");

    cJSON_AddNumberToObject(device, "id", telemetry.device_id);
    cJSON_AddStringToObject(device, "name", telemetry.device_name);
    cJSON_AddStringToObject(device, "firmware", telemetry.firmware);

    cJSON_AddNumberToObject(system, "uptime", telemetry.uptime);
    cJSON_AddNumberToObject(system, "rssi", telemetry.rssi);

    for(size_t i = 0;i < telemetry.capability_count;i++){
        const capability_t *cap = &telemetry.capabilities[i];
        cJSON *capability = cJSON_AddObjectToObject(capabilities, cap->name);
        cJSON_AddNumberToObject(capability, "value", cap->value);
        cJSON_AddBoolToObject(capability, "valid", cap->valid);
    }

    send_response(response);

    cJSON_Delete(response);

}

static void handle_set_config(cJSON *root){

    bool device_name_updated = false;
    bool telemetry_interval_updated = false;

    cJSON *data = cJSON_GetObjectItem(root, "data");

    cJSON *name = cJSON_GetObjectItem(data, "device_name");
    cJSON *telemetry_interval = cJSON_GetObjectItem(data, "telemetry_interval_sec");

    if(name && cJSON_IsString(name))
        if(config_manager_update_device_name(name->valuestring) == ESP_OK)
            device_name_updated = true;

    if(telemetry_interval && cJSON_IsNumber(telemetry_interval))
        if(config_manager_update_telemetry_interval((uint32_t)telemetry_interval->valuedouble) == ESP_OK)
            telemetry_interval_updated = true;

    const app_config_t *config = config_manager_get();

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *response_data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddBoolToObject(response_data, "device_name", device_name_updated);
    cJSON_AddBoolToObject(response_data, "telemetry_interval_sec", telemetry_interval_updated);
    cJSON_AddNumberToObject(response_data, "current_telemetry_interval_sec", config->telemetry_interval_sec);

    send_response(response);

    cJSON_Delete(response);

}

static void handle_restart(cJSON *root){

    cJSON *response = cJSON_CreateObject();

    cJSON_AddBoolToObject(response, "success", true);

    cJSON *data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddStringToObject(data, "message", "Restarting");

    send_response(response);

    cJSON_Delete(response);

    vTaskDelay(pdMS_TO_TICKS(1000));

    esp_restart();

}

static void ota_status_report(bool success, const char *message){

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", success);
    cJSON *data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddStringToObject(data, "message", message);

    send_response(response);

    cJSON_Delete(response);

}

static void handle_ota_update(cJSON *root){

    cJSON *data = cJSON_GetObjectItem(root, "data");
    cJSON *url = cJSON_GetObjectItem(data, "url");
    cJSON *version = cJSON_GetObjectItem(data, "version");
    cJSON *sha256 = cJSON_GetObjectItem(data, "sha256");

    if((url == NULL) || !cJSON_IsString(url) || (sha256 == NULL) || !cJSON_IsString(sha256)){
        cJSON *response = cJSON_CreateObject();
        cJSON_AddBoolToObject(response, "success", false);
        cJSON_AddStringToObject(response, "error", "OTA command requires 'url' and 'sha256'");
        send_response(response);
        cJSON_Delete(response);
        return;
    }

    const device_info_t *info = device_info_get();
    if((version != NULL) && cJSON_IsString(version) && (strcmp(version->valuestring, info->firmware) == 0)){
        cJSON *response = cJSON_CreateObject();
        cJSON_AddBoolToObject(response, "success", false);
        cJSON *response_data = cJSON_AddObjectToObject(response, "data");
        cJSON_AddStringToObject(response_data, "message", "Already running this version, OTA skipped");
        send_response(response);
        cJSON_Delete(response);
        return;
    }

    if(ota_manager_start(url->valuestring, sha256->valuestring, ota_status_report) != ESP_OK){
        cJSON *response = cJSON_CreateObject();
        cJSON_AddBoolToObject(response, "success", false);
        cJSON_AddStringToObject(response, "error", "Failed to start OTA task");
        send_response(response);
        cJSON_Delete(response);
        return;
    }

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *response_data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddStringToObject(response_data, "message", "OTA started");
    send_response(response);
    cJSON_Delete(response);

}

/*==========================================================
 * Public Functions
 *=========================================================*/

void command_manager_init(command_response_callback_t callback){

    response_callback = callback;

    LOG_INFO(TAG, "Command manager initialized");

}

void command_manager_handle(const char *payload, int length){

    LOG_INFO(TAG, "Raw payload: %.*s", length, payload);

    cJSON *root = cJSON_ParseWithLength(payload, length);
    if(root == NULL){
        LOG_ERROR(TAG, "Invalid JSON");
        return;
    }

    cJSON *command = cJSON_GetObjectItem(root, "command");
    if((command == NULL) || !cJSON_IsString(command)){
        LOG_ERROR(TAG, "Missing command");
        cJSON_Delete(root);
        return;
    }

    for(size_t i = 0;i < COMMAND_COUNT;i++){
        if(strcmp(command->valuestring, command_table[i].name) == 0){
            command_table[i].handler(root);
            cJSON_Delete(root);
            return;
        }
    }

    LOG_WARN(TAG, "Unknown command: %s", command->valuestring);

    cJSON *response = cJSON_CreateObject();

    cJSON_AddBoolToObject(response, "success", false);
    cJSON_AddStringToObject(response, "error", "Unknown command");

    send_response(response);

    cJSON_Delete(response);
    cJSON_Delete(root);

}

