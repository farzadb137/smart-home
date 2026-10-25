idf_component_register(
    SRCS "src/status_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        logger
        device_info
        system_info
        wifi_manager
        mqtt_manager
        cjson
)