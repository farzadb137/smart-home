#ifndef DEVICE_INFO_H
#define DEVICE_INFO_H

#ifdef __cplusplus
extern "C"{
#endif

typedef enum{
    DEVICE_TYPE_TEMPERATURE,
    DEVICE_TYPE_SWITCH,
    DEVICE_TYPE_DOOR_SENSOR
}device_type_t;

typedef struct{
    const char *name;
    device_type_t type;
    const char *firmware;
    const char *hardware;
}device_info_t;


void device_info_init(void);
const device_info_t *device_info_get(void);
const char *device_type_to_string(device_type_t type);
void device_info_print(void);

#ifdef __cplusplus
}
#endif

#endif