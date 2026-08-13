#include "telemetry_serializer.h"

#include "cJSON.h"

/*==========================================================
 * Public Functions
 *=========================================================*/

char *telemetry_serializer_to_json(const telemetry_t *telemetry){

    if(telemetry == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();

    if(root == NULL)
        return NULL;

    cJSON *device = cJSON_AddObjectToObject(root, "device");
    cJSON *system = cJSON_AddObjectToObject(root, "system");
    cJSON *sensor = cJSON_AddObjectToObject(root, "sensor");

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