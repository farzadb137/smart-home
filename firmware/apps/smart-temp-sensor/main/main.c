#include "led_manager.h"
#include "logger.h"
#include "config_manager.h"
#include "button_manager.h"
#include "device_info.h"
#include "system_info.h"
#include "provision_manager.h"
#include "sensor_manager.h"
#include "wifi_manager.h"
#include "time_manager.h"
#include "mqtt_manager.h"
#include "app_manager.h"
#include "capability_drivers.h"

void app_main(void){

    //1. LED Indication
    led_manager_init();
    led_manager_set_state(LED_STATE_BOOT);

    // 2. Logging
    logger_init();

    // 3. configuration
    config_manager_init();

    //4. General purpose button
    button_manager_init();

    // 5. Static information
    device_info_init(DEVICE_TYPE_TEMPERATURE, "SmartTemp-V1.0", "0.5.1");

    // 6. System information
    system_info_init();

    // 7. Hardware
    sensor_manager_init();
    capability_drivers_register();

    if(config_manager_is_provisioned()){

        // 8. Network
        wifi_manager_init();

        // 8b. Time sync (non-blocking - syncs in the background once connected)
        time_manager_init();

        // 9. Communication
        mqtt_manager_init();

        // 10. Application tasks
        app_manager_start();

    }
    else{

        // 8. provisioning
        provision_manager_init();

    }

}