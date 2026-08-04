#include "device_info.h"

#include <stdio.h>

static device_info_t device_info = {
    .name = "TEMP_LIVING_0001",
    .type = DEVICE_TYPE_TEMPERATURE,
    .firmware = "0.1.0",
    .hardware = "Rev A"
};


void device_info_init(void){
    
}

const device_info_t *device_info_get(void){
    return &device_info;
}

const char *device_type_to_string(device_type_t type){

    switch(type){
        case DEVICE_TYPE_TEMPERATURE:
            return "Temperature Node";
        case DEVICE_TYPE_SWITCH:
            return "Smart Switch";
        case DEVICE_TYPE_DOOR_SENSOR:
            return "Door Sensor";
        default:
            return "Unknown";
    }

}

void device_info_print(void){

    const device_info_t *info = device_info_get();

    printf("\n");
    printf("=========== DEVICE ===========\n");
    printf("Name        : %s\n", info->name);
    printf("Type        : %s\n", device_type_to_string(info->type));
    printf("Firmware    : %s\n", info->firmware);
    printf("Hardware    : %s\n", info->hardware);
    printf("==============================\n");
}