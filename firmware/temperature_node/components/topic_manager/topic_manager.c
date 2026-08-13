#include "topic_manager.h"

#include "device_info.h"

#include <stdio.h>


static char telemetry_topic[128];
static char status_topic[128];
static char command_topic[128];
static char response_topic[128];

/*==========================================================
 * Public Functions
 *=========================================================*/

const char *topic_manager_get_telemetry(void){

    const device_info_t *info = device_info_get();

    snprintf(telemetry_topic, sizeof(telemetry_topic), "home/devices/%s/telemetry", info->name);

    return telemetry_topic;
}


const char *topic_manager_get_status(void){

    const device_info_t *info = device_info_get();

    snprintf(status_topic, sizeof(status_topic), "home/devices/%s/status", info->name);

    return status_topic;
}

const char *topic_manager_get_command(void){

    const device_info_t *info = device_info_get();

    snprintf(command_topic, sizeof(command_topic), "home/devices/%s/command", info->name);

    return command_topic;
}

const char *topic_manager_get_response(void){

    const device_info_t *info = device_info_get();

    snprintf(response_topic, sizeof(response_topic), "home/devices/%s/response", info->name);

    return response_topic;
}