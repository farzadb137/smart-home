#ifndef CAPABILITY_H
#define CAPABILITY_H

#ifdef __cplusplus
extern "C"{
#endif

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

#define CAPABILITY_NAME_MAX 16

/* A node can expose more than one capability - e.g. a battery-powered
 * door sensor reports both "contact" and "battery". CAPABILITY_MAX bounds
 * how many a single node build can register; raise it if a future node
 * type needs more. */
#define CAPABILITY_MAX 4

typedef enum{
    CAP_TYPE_NUMERIC,   /* e.g. temperature, battery percentage    */
    CAP_TYPE_BINARY     /* e.g. switch on/off, contact open/closed */
}capability_value_type_t;

typedef enum{
    CAP_ACCESS_READ  = 1 << 0,  /* device publishes this value    */
    CAP_ACCESS_WRITE = 1 << 1   /* value can be commanded ("set") */
}capability_access_t;

/* Current snapshot of one capability, as exposed to the rest of the
 * firmware (telemetry_manager, command_manager). */
typedef struct{
    char name[CAPABILITY_NAME_MAX];
    capability_value_type_t type;
    capability_access_t access;
    float value;      /* numeric value, or 0.0f/1.0f for binary */
    bool valid;
}capability_t;

/* Implemented once per physical capability (a ds18b20 probe, a relay
 * output, a reed switch input...) and registered with
 * sensor_manager_register(). init runs once at registration; read is
 * polled periodically (NULL if write-only, e.g. a pure actuator with
 * no readback); write is invoked by sensor_manager_set_capability()
 * (NULL if read-only, e.g. a sensor). */
typedef struct{
    const char *name;
    capability_value_type_t type;
    capability_access_t access;
    esp_err_t (*init)(void);
    bool (*read)(float *value);
    esp_err_t (*write)(float value);
}capability_driver_t;

#ifdef __cplusplus
}
#endif

#endif