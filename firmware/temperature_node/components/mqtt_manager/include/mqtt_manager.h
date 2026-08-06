#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include "esp_err.h"



esp_err_t mqtt_manager_init(void);
esp_err_t mqtt_manager_publish(const char *topic, const char *payload, int qos, bool retain);
bool mqtt_manager_is_connected(void);



#endif