#include "led_manager.h"
#include "logger.h"
#include "config_manager.h"
#include "device_info.h"
#include "system_info.h"
#include "sensor_manager.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "app_manager.h"

void app_main(void){

    //1. LED Indication
    led_manager_init();
    led_manager_set_state(LED_STATE_BOOT);

    // 2. Logging
    logger_init();

    // 3. configuration
    config_manager_init();

    // 4. Static information
    device_info_init();

    // 5. System information
    system_info_init();

    // 6. Hardware
    sensor_manager_init();

    // 7. Network
    wifi_manager_init();

    // 8. Communication
    mqtt_manager_init();

    // 9. Application tasks
    app_manager_start();

}