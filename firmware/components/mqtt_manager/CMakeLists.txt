idf_component_register(
    SRCS "src/mqtt_manager.c"
    INCLUDE_DIRS "include"
    EMBED_TXTFILES "certs/mqtt_ca_cert.pem"
    REQUIRES
        led_manager
        logger
        config_manager
        mqtt
        telemetry_manager
        topic_manager
        command_manager
        ota_manager
        time_manager
)