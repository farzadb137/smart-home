#ifndef DEVICE_INFO_H
#define DEVICE_INFO_H

#ifdef __cplusplus
extern "C"{
#endif

#include <stdint.h>
#include <stddef.h>

/* hardware_id is 48 bits (from MAC), formatted as 12 uppercase hex chars + null.
 * This is the ONE identity string used consistently for MQTT username,
 * MQTT topics, and the provisioning AP SSID - see device_info_get_id_hex(). */
#define DEVICE_ID_HEX_LEN 13

typedef enum{
    DEVICE_TYPE_TEMPERATURE,
    DEVICE_TYPE_SWITCH,
    DEVICE_TYPE_DOOR_SENSOR
}device_type_t;

typedef struct{
    char name[32];
    uint64_t id;
    const char *manufacturer;
    const char *model;
    device_type_t type;
    const char *firmware;
    const char *hardware;
}device_info_t;


void device_info_init(void);
const device_info_t *device_info_get(void);
const char *device_type_to_string(device_type_t type);
void device_info_get_id_hex(char *out, size_t out_size);
const char *device_type_to_capability(device_type_t type);
const char *device_info_get_capability(void);
void device_info_print(void);

#ifdef __cplusplus
}
#endif

#endif