#include "status_manager.h"

#include "logger.h"
#include "device_info.h"
#include "system_info.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"

#include "cJSON.h"
#include <string.h>

static const char *TAG = "STATUS";

/*==========================================================
 * Public Functions
 *=========================================================*/

void status_manager_get(status_t *data){

    if(data == NULL)
        return;

    memset(data, 0, sizeof(status_t));

    const device_info_t *device_info = device_info_get();
    if(device_info)
        data->device_id = device_info->id;

    data->online = true;

    const system_info_t *system_info = system_info_get();
    if(system_info)
        data->uptime = system_info->uptime_seconds;

    const wifi_status_t *wifi = wifi_manager_get_status();
    if(wifi){
        data->wifi_is_connected = (wifi->state == WIFI_STATE_CONNECTED);
        data->rssi = wifi->rssi;
    }

    data->mqtt_is_connected = mqtt_manager_is_connected();
        
}

char *status_manager_to_json(const status_t *status){

    if(status == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();
    if(root == NULL)
        return NULL;

    cJSON_AddNumberToObject(root, "id", status->device_id);
    cJSON_AddBoolToObject(root, "online", status->online);
    cJSON_AddNumberToObject(root, "uptime", status->uptime);
    cJSON_AddBoolToObject(root, "wifi", status->wifi_is_connected);
    cJSON_AddNumberToObject(root, "rssi", status->rssi);
    cJSON_AddBoolToObject(root, "mqtt", status->mqtt_is_connected);

    char *json = cJSON_PrintUnformatted(root);

    cJSON_Delete(root);

    return json;
}

void status_manager_print(void){

    status_t data;

    status_manager_get(&data);

    LOG_INFO(TAG, "========== STATUS ==========");
    LOG_INFO(TAG, "Device      : %d", data.device_id);
    LOG_INFO(TAG, "Online      : %s", data.online?"True":"False");
    LOG_INFO(TAG, "Uptime      : %lu", data.uptime);
    LOG_INFO(TAG, "WiFi        : %s", data.wifi_is_connected?"Connected":"Connecting");
    LOG_INFO(TAG, "RSSI        : %d dBm", data.rssi);
    LOG_INFO(TAG, "MQTT        : %s", data.mqtt_is_connected?"Connected":"Connecting");
    LOG_INFO(TAG, "==============================");

}