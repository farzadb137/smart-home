#ifndef TELEMETRY_MANAGER_H
#define TELEMETRY_MANAGER_H

#include <stdbool.h>
#include <stdint.h>


typedef struct{
    uint64_t device_id;
    char device_name[32];
    char device_type[32];
    char firmware[16];
    float temperature;
    bool sensor_valid;
    uint32_t uptime;
    int rssi;
}telemetry_t;



void telemetry_manager_init(void);
void telemetry_manager_get(telemetry_t *data);
char *telemetry_manager_to_json(const telemetry_t *telemetry);
void telemetry_manager_print(void);


#endif