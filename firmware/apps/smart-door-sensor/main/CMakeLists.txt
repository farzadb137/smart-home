set(BSP_DIR ${CMAKE_CURRENT_LIST_DIR}/../../../bsp/smart-door-sensor/rev-A)

idf_component_register(SRCS "main.c" "capability_drivers.c" "${BSP_DIR}/src/bsp.c"
                    INCLUDE_DIRS "." "${BSP_DIR}/include"
                    REQUIRES 
                        led_manager
                        logger
                        config_manager
                        button_manager
                        device_info
                        system_info
                        provision_manager
                        sensor_manager
                        wifi_manager
                        time_manager
                        mqtt_manager
                        app_manager
                        esp_driver_gpio
)