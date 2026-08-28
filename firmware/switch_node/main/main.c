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

    led_manager_init();
    led_manager_set_state(LED_STATE_BOOT);

    logger_init();

    config_manager_init();

    button_manager_init();

    device_info_init(DEVICE_TYPE_SWITCH, "SmartSwitch-V1.0", "0.5.0");

    system_info_init();

    sensor_manager_init();
    capability_drivers_register();

    if(config_manager_is_provisioned()){

        wifi_manager_init();
        time_manager_init();
        mqtt_manager_init();
        app_manager_start();

    }
    else{

        provision_manager_init();

    }

}