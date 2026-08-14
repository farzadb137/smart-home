#include "telemetry_manager.h"

#include "logger.h"
#include "device_info.h"
#include "system_info.h"
#include "sensor_manager.h"
#include "wifi_manager.h"

#include <string.h>
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
        strncpy(data->firmware, device_info->firmware, sizeof(data->firmware) - 1);
    }

    const system_info_t *system_info = system_info_get();
    if(system_info)
        data->uptime = system_info->uptime_seconds;

    const sensor_data_t *sensor = sensor_manager_get_data();
    if(sensor){
        data->temperature = sensor->temperature;
        data->sensor_valid = sensor->valid;
    }

    const wifi_status_t *wifi = wifi_manager_get_status();
    if(wifi)
        data->rssi = wifi->rssi;

}

char *telemetry_manager_to_json(const telemetry_t *telemetry){

    if(telemetry == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();
    if(root == NULL)
        return NULL;

    cJSON *device = cJSON_AddObjectToObject(root, "device");
    cJSON *system = cJSON_AddObjectToObject(root, "system");
    cJSON *sensor = cJSON_AddObjectToObject(root, "sensor");

    cJSON_AddNumberToObject(device, "id", telemetry->device_id);
    cJSON_AddStringToObject(device, "name", telemetry->device_name);
    cJSON_AddStringToObject(device, "firmware", telemetry->firmware);

    cJSON_AddNumberToObject(system, "uptime", telemetry->uptime);
    cJSON_AddNumberToObject(system, "rssi", telemetry->rssi);

    cJSON_AddNumberToObject(sensor, "temperature", telemetry->temperature);
    cJSON_AddBoolToObject(sensor, "valid", telemetry->sensor_valid);

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
    LOG_INFO(TAG, "Temperature : %.2f C", data.temperature);
    LOG_INFO(TAG, "Sensor      : %s", data.sensor_valid ? "OK" : "ERROR");
    LOG_INFO(TAG, "Uptime      : %lu s", data.uptime);
    LOG_INFO(TAG, "RSSI        : %d dBm", data.rssi);
    LOG_INFO(TAG, "==============================");

}