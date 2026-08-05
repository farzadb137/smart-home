idf_component_register(SRCS "main.c"
                    INCLUDE_DIRS "."
                    REQUIRES 
                        logger
                        device_info
                        system_info
                        wifi_manager
                        nvs_flash
                        sensor_manager
)