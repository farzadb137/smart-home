idf_component_register(
    SRCS "status_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        logger
        device_info
        system_info
        wifi_manager
        mqtt_manager
        cjson
)