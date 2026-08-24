idf_component_register(
    SRCS "app_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        config_manager
        logger
        telemetry_manager
        status_manager
        mqtt_manager
        topic_manager
        cjson
)