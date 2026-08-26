idf_component_register(
    SRCS "mqtt_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        led_manager
        logger
        config_manager
        mqtt
        telemetry_manager
        topic_manager
        command_manager
        ota_manager
)