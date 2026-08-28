#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#ifdef __cplusplus
extern "C" {
#endif

#include "capability.h"
#include "esp_err.h"
#include <stddef.h>


void sensor_manager_init(void);

/* Registers one capability driver. Called internally by sensor_manager_init()
 * for whichever capabilities this node build provides. */
esp_err_t sensor_manager_register(const capability_driver_t *driver);

/* Fills 'out' with up to 'max' currently registered capabilities and
 * returns how many were written. Used by telemetry_manager. */
size_t sensor_manager_get_capabilities(capability_t *out, size_t max);

/* Commands a writable capability (e.g. a switch) to a new value.
 * Not called anywhere yet - wired up in Phase 2 once an actuator
 * node and its command_manager handler exist. */
esp_err_t sensor_manager_set_capability(const char *name, float value);


#ifdef __cplusplus
}
#endif

#endif