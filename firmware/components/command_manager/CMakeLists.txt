idf_component_register(
    SRCS "src/command_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        logger
        config_manager
        status_manager
        telemetry_manager
        sensor_manager
        ota_manager
        device_info
        cjson
)