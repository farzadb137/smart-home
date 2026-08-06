#include "mqtt_manager.h"

#include "logger.h"
#include "config_manager.h"
#include "topic_manager.h"

#include "mqtt_client.h"

#include <stdbool.h>


static const char *TAG = "MQTT";

static esp_mqtt_client_handle_t client = NULL;
static bool mqtt_connected = false;

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data){

    switch(event_id){
        case MQTT_EVENT_CONNECTED:
            mqtt_connected = true;
            mqtt_manager_publish(topic_manager_get_status(), "{\"online\":true}", 1, true);
            LOG_INFO(TAG, "MQTT connected");
            break;
        case MQTT_EVENT_DISCONNECTED:
            mqtt_connected = false;
            LOG_INFO(TAG, "MQTT disconnected");
            break;
        case MQTT_EVENT_ERROR:
            esp_mqtt_error_codes_t *err = event_data;
            if(err->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT)
                LOG_ERROR(TAG, "Socket errno=%d", err->esp_transport_sock_errno);
            else
                LOG_ERROR(TAG, "MQTT error");
            break;
        case MQTT_EVENT_BEFORE_CONNECT:
            LOG_INFO(TAG, "Connecting to broker...");
            break;
        default:
            break;
    }

}

esp_err_t mqtt_manager_init(void){

    const app_config_t *config = config_manager_get();
    if(config == NULL)
        return ESP_ERR_INVALID_STATE;

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = config->mqtt_uri,
        .session.last_will.topic = topic_manager_get_status(),
        .session.last_will.msg = "{\"online\":false}",
        .session.last_will.msg_len = 16,
        .session.last_will.qos = 1,
        .session.last_will.retain = true
    };

    client = esp_mqtt_client_init(&mqtt_cfg);
    if(client == NULL)
        return ESP_FAIL;

    esp_mqtt_client_register_event(client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);

    return esp_mqtt_client_start(client);
}

esp_err_t mqtt_manager_publish(const char *topic, const char *payload, int qos, bool retain){

    if((client == NULL) || (!mqtt_connected))
        return ESP_ERR_INVALID_STATE;

    int msg_id = esp_mqtt_client_publish(client, topic, payload, 0, qos, retain);
    if(msg_id < 0)
        return ESP_FAIL;

    return ESP_OK;
}

bool mqtt_manager_is_connected(void){
    return mqtt_connected;
}




