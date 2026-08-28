#include "telemetry_manager.h"

#include "logger.h"
#include "device_info.h"
#include "system_info.h"
#include "sensor_manager.h"
#include "wifi_manager.h"
#include "time_manager.h"

#include <string.h>
#include <time.h>
#include "cJSON.h"

static const char *TAG = "TELEMETRY";

/*==========================================================
 * Public Functions
 *=========================================================*/

void telemetry_manager_get(telemetry_t *data){

    if(data == NULL)
        return;

    memset(data, 0, sizeof(telemetry_t));

    const device_info_t *device_info = device_info_get();
    if(device_info){
        data->device_id = device_info->id;
        strncpy(data->device_name, device_info->name, sizeof(data->device_name) - 1);
        strncpy(data->device_type, device_type_to_string(device_info->type), sizeof(data->device_type) - 1);
        strncpy(data->firmware, device_info->firmware, sizeof(data->firmware) - 1);
    }

    data->capability_count = sensor_manager_get_capabilities(data->capabilities, CAPABILITY_MAX);

    const system_info_t *system_info = system_info_get();
    if(system_info)
        data->uptime = system_info->uptime_seconds;

    const wifi_status_t *wifi = wifi_manager_get_status();
    if(wifi)
        data->rssi = wifi->rssi;

    if(time_manager_is_synced()){
        data->timestamp = time(NULL);
        data->time_valid = true;
    }
    else{
        data->timestamp = 0;
        data->time_valid = false;
    }

}

char *telemetry_manager_to_json(const telemetry_t *telemetry){

    if(telemetry == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();
    if(root == NULL)
        return NULL;

    cJSON *device = cJSON_AddObjectToObject(root, "device");
    cJSON *system = cJSON_AddObjectToObject(root, "system");
    cJSON *capabilities = cJSON_AddObjectToObject(root, "capabilities");

    cJSON_AddNumberToObject(device, "id", telemetry->device_id);
    cJSON_AddStringToObject(device, "name", telemetry->device_name);
    cJSON_AddStringToObject(device, "type", telemetry->device_type);
    cJSON_AddStringToObject(device, "firmware", telemetry->firmware);

    cJSON_AddNumberToObject(system, "uptime", telemetry->uptime);
    cJSON_AddNumberToObject(system, "rssi", telemetry->rssi);
    cJSON_AddNumberToObject(system, "timestamp", (double)telemetry->timestamp);
    cJSON_AddBoolToObject(system, "time_valid", telemetry->time_valid);

    for(size_t i = 0;i < telemetry->capability_count;i++){
        const capability_t *cap = &telemetry->capabilities[i];
        cJSON *capability = cJSON_AddObjectToObject(capabilities, cap->name);
        cJSON_AddNumberToObject(capability, "value", cap->value);
        cJSON_AddBoolToObject(capability, "valid", cap->valid);
    }

    char *json = cJSON_PrintUnformatted(root);

    cJSON_Delete(root);

    return json;
}

void telemetry_manager_print(void){

    telemetry_t data;

    telemetry_manager_get(&data);

    LOG_INFO(TAG, "========== TELEMETRY ==========");
    LOG_INFO(TAG, "Device      : %d", data.device_id);
    LOG_INFO(TAG, "Name        : %s", data.device_name);
    LOG_INFO(TAG, "Firmware    : %s", data.firmware);
    for(size_t i = 0;i < data.capability_count;i++)
        LOG_INFO(TAG, "%-12s: %.2f (%s)", data.capabilities[i].name, data.capabilities[i].value, data.capabilities[i].valid ? "OK" : "ERROR");
    LOG_INFO(TAG, "Uptime      : %lu s", data.uptime);
    LOG_INFO(TAG, "RSSI        : %d dBm", data.rssi);
    LOG_INFO(TAG, "==============================");

}