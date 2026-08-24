#include "command_manager.h"

#include "logger.h"
#include "config_manager.h"
#include "status_manager.h"
#include "telemetry_manager.h"

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
static void handle_restart(cJSON *root);


static const command_entry_t command_table[] = {
    { "get_config",     handle_get_config       },
    { "get_status",     handle_get_status       },
    { "get_telemetry",  handle_get_telemetry    },
    { "set_config",     handle_set_config       },
    { "restart",        handle_restart          },
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
    cJSON *sensor = cJSON_AddObjectToObject(data, "sensor");

    cJSON_AddNumberToObject(device, "id", telemetry.device_id);
    cJSON_AddStringToObject(device, "name", telemetry.device_name);
    cJSON_AddStringToObject(device, "firmware", telemetry.firmware);

    cJSON_AddNumberToObject(system, "uptime", telemetry.uptime);
    cJSON_AddNumberToObject(system, "rssi", telemetry.rssi);

    cJSON_AddNumberToObject(sensor, "temperature", telemetry.temperature);
    cJSON_AddBoolToObject(sensor, "valid", telemetry.sensor_valid);

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

