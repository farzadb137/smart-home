#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#ifdef __cplusplus
extern "C" {
#endif


#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#define WIFI_CONNECTED_BIT BIT0

#define WIFI_RETRY_INITIAL_DELAY_MS 5000
#define WIFI_RETRY_MAX_DELAY_MS 60000


typedef enum{
    WIFI_STATE_DISCONNECTED,
    WIFI_STATE_CONNECTING,
    WIFI_STATE_CONNECTED
}wifi_state_t;


typedef struct{
    wifi_state_t state;
    int8_t rssi;
    char ip[16];
    char ssid[32];
}wifi_status_t;



void wifi_manager_init(void);
void wifi_manager_start(void);
const wifi_status_t *wifi_manager_get_status(void);
EventGroupHandle_t wifi_manager_get_event_group(void);



#ifdef __cplusplus
}
#endif

#endif