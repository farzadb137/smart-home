#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

#define WIFI_CONNECTED_BIT BIT0

EventGroupHandle_t system_events;

void wifi_task(void *pvParameters)
{
    printf("Connecting WiFi...\n");

    vTaskDelay(
        pdMS_TO_TICKS(3000)
    );

    printf("WiFi Connected!\n");


    xEventGroupSetBits(
        system_events,
        WIFI_CONNECTED_BIT
    );


    while(1)
    {
        vTaskDelay(
            pdMS_TO_TICKS(1000)
        );
    }
}


void mqtt_task(void *pvParameters)
{

    xEventGroupWaitBits(
        system_events,
        WIFI_CONNECTED_BIT,
        pdFALSE,
        pdTRUE,
        portMAX_DELAY
    );


    printf(
        "Starting MQTT...\n"
    );


    while(1)
    {
        vTaskDelay(
            pdMS_TO_TICKS(1000)
        );
    }
}


void app_main(void)
{
    system_events = xEventGroupCreate();

    xTaskCreate(
        wifi_task,
        "wifi",
        2048,
        NULL,
        5,
        NULL
    );

    xTaskCreate(
        mqtt_task,
        "MQTT",
        2048,
        NULL,
        5,
        NULL
    );
}