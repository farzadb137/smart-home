#ifndef STATUS_MANAGER_H
#define STATUS_MANAGER_H

#include <stdbool.h>
#include <stdint.h>


typedef struct{
    uint64_t device_id;
    bool online;
    uint32_t uptime;
    bool wifi_is_connected;
    int rssi;
    bool mqtt_is_connected;
}status_t;



void status_manager_init(void);
void status_manager_get(status_t *data);
char *status_manager_to_json(const status_t *status);
void status_manager_print(void);


#endif