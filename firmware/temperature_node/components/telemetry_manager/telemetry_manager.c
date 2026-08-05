#include "telemetry_manager.h"

#include "device_info.h"
#include "system_info.h"
#include "sensor_manager.h"
#include "wifi_manager.h"
#include "esp_log.h"

#include <string.h>

static const char *TAG = "TELEMETRY";

void telemetry_manager_get(telemetry_t *data){

    memset(data, 0, sizeof(telemetry_t));

    const device_info_t *device_info = device_info_get();
    if(device_info){
        strncpy(data->device_name, device_info->name, sizeof(data->device_name) - 1);
        strncpy(data->firmware, device_info->firmware, sizeof(data->firmware) - 1);
    }

    const sensor_data_t *sensor = sensor_manager_get_data();
    if(sensor){
        data->temperature = sensor->temperature;
        data->sensor_valid = sensor->valid;
    }

    const system_info_t *system_info = system_info_get();
    if(system_info)
        data->uptime = system_info->uptime_seconds;

    const wifi_status_t *wifi = wifi_manager_get_status();
    if(wifi)
        data->rssi = wifi->rssi;
}

void telemetry_manager_print(void){

    telemetry_t data;

    telemetry_manager_get(&data);

    ESP_LOGI(TAG, "========== TELEMETRY ==========");
    ESP_LOGI(TAG, "Device      : %s", data.device_name);
    ESP_LOGI(TAG, "Firmware    : %s", data.firmware);
    ESP_LOGI(TAG, "Temperature : %.2f C", data.temperature);
    ESP_LOGI(TAG, "Sensor      : %s", data.sensor_valid ? "OK" : "ERROR");
    ESP_LOGI(TAG, "Uptime      : %lu s", data.uptime);
    ESP_LOGI(TAG, "RSSI        : %d dBm", data.rssi);
    ESP_LOGI(TAG, "==============================");

}