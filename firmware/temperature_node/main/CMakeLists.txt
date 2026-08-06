idf_component_register(SRCS "main.c"
                    INCLUDE_DIRS "."
                    REQUIRES 
                        logger
                        nvs_flash
                        config_manager
                        device_info
                        system_info
                        sensor_manager
                        wifi_manager
                        mqtt_manager
                        app_manager
)