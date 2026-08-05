idf_component_register(SRCS "main.c"
                    INCLUDE_DIRS "."
                    REQUIRES device_info logger system_info wifi_manager nvs_flash sensor_manager)