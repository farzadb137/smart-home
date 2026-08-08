#include "command_manager.h"

#include "logger.h"
#include "config_manager.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"

#include "esp_timer.h"
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
static void handle_set_config(cJSON *root);
static void handle_restart(cJSON *root);


static const command_entry_t command_table[] = {
    { "get_config",     handle_get_config   },
    { "get_status",     handle_get_status   },
    { "set_config",     handle_set_config   },
    { "restart",        handle_restart      },
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

    send_response(response);

    cJSON_Delete(response);

 }

static void handle_get_status(cJSON *root){

    const wifi_status_t *wifi_status = wifi_manager_get_status();

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *data = cJSON_AddObjectToObject(response, "data");
    uint32_t uptime = esp_timer_get_time() / 1000000;
    cJSON_AddNumberToObject(data, "uptime", uptime);
    cJSON_AddBoolToObject(data, "wifi", wifi_status->state == WIFI_STATE_CONNECTED);
    cJSON_AddBoolToObject(data, "mqtt", mqtt_manager_is_connected());
    cJSON_AddNumberToObject(data, "rssi", wifi_status->rssi);

    send_response(response);

    cJSON_Delete(response);

}

static void handle_set_config(cJSON *root){

    bool device_name_updated = false;
    bool mqtt_uri_updated = false;

    cJSON *data = cJSON_GetObjectItem(root, "data");

    cJSON *name = cJSON_GetObjectItem(data, "device_name");
    cJSON *mqtt_uri = cJSON_GetObjectItem(data, "mqtt_uri");

    if(name && cJSON_IsString(name))
        if(config_manager_update_device_name(name->valuestring) == ESP_OK)
            device_name_updated = true;

    if(mqtt_uri && cJSON_IsString(mqtt_uri))
        if(config_manager_update_mqtt_uri(mqtt_uri->valuestring) == ESP_OK)
            mqtt_uri_updated = true;

    cJSON *response = cJSON_CreateObject();
    cJSON_AddBoolToObject(response, "success", true);
    cJSON *response_data = cJSON_AddObjectToObject(response, "data");
    cJSON_AddBoolToObject(response_data, "device_name", device_name_updated);
    cJSON_AddBoolToObject(response_data, "mqtt_uri", mqtt_uri_updated);

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

    vTaskDelay(pdMS_TO_TICKS(500));

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

