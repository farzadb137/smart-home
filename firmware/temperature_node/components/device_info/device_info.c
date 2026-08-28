#include "device_info.h"

#include "config_manager.h"

#include "esp_mac.h"
#include <string.h>

static device_info_t device_info;

/*==========================================================
 * Public Functions
 *=========================================================*/

void device_info_init(void){

    const app_config_t *config = config_manager_get();

    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);

    device_info = (device_info_t){
        .id = ((uint64_t)mac[0] << 40) | ((uint64_t)mac[1] << 32) | ((uint64_t)mac[2] << 24) | ((uint64_t)mac[3] << 16) | ((uint64_t)mac[4] << 8) | ((uint64_t)mac[5]),
        .manufacturer = "BSM",
        .type = DEVICE_TYPE_TEMPERATURE,
        .model = "SmartTemp-V1.0",
        .firmware = "0.4.0",
        .hardware = "Rev A",
        .name = ""
    };

    strncpy((char *)device_info.name, config->device_name, sizeof(device_info.name) - 1);
    
}

const device_info_t *device_info_get(void){
    return &device_info;
}

const char *device_type_to_string(device_type_t type){

    switch(type){
        case DEVICE_TYPE_TEMPERATURE:   return "Temperature Node";
        case DEVICE_TYPE_SWITCH:        return "Smart Switch";
        case DEVICE_TYPE_DOOR_SENSOR:   return "Door Sensor";
        default:                        return "Unknown";
    }

}

void device_info_get_id_hex(char *out, size_t out_size){
 
    const device_info_t *info = device_info_get();
 
    /* mask to 48 bits, zero-padded so the string length is always fixed
     * (a leading-zero ID must not silently produce a shorter string, or
     * downstream ACL/topic matching gets subtle and hard-to-debug bugs) */
    snprintf(out, out_size, "%012llX", (unsigned long long)(info->id & 0xFFFFFFFFFFFFULL));
 
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