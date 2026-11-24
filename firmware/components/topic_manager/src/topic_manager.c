#include "topic_manager.h"

#include "device_info.h"

#include "topics.h"

#include <stdio.h>


static char telemetry_topic[128];
static char status_topic[128];
static char command_topic[128];
static char response_topic[128];

/*==========================================================
 * Public Functions
 *=========================================================*/

const char *topic_manager_get_telemetry(void){

    char id_hex[DEVICE_ID_HEX_LEN];
    device_info_get_id_hex(id_hex, sizeof(id_hex));

    snprintf(telemetry_topic, sizeof(telemetry_topic), TOPIC_TELEMETRY, id_hex);

    return telemetry_topic;
}


const char *topic_manager_get_status(void){

    char id_hex[DEVICE_ID_HEX_LEN];
    device_info_get_id_hex(id_hex, sizeof(id_hex));

    snprintf(status_topic, sizeof(status_topic), TOPIC_STATUS, id_hex);

    return status_topic;
}

const char *topic_manager_get_command(void){

    char id_hex[DEVICE_ID_HEX_LEN];
    device_info_get_id_hex(id_hex, sizeof(id_hex));

    snprintf(command_topic, sizeof(command_topic), TOPIC_COMMAND, id_hex);

    return command_topic;
}

const char *topic_manager_get_response(void){

    char id_hex[DEVICE_ID_HEX_LEN];
    device_info_get_id_hex(id_hex, sizeof(id_hex));

    snprintf(response_topic, sizeof(response_topic), TOPIC_RESPONSE, id_hex);

    return response_topic;
}

const char *topic_manager_get_time_sync(void){

    return TOPIC_TIME;

}