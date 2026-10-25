idf_component_register(
    SRCS "src/app_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        logger
        telemetry_manager
        status_manager
        mqtt_manager
        topic_manager
        config_manager
        telemetry_buffer
        cjson
)