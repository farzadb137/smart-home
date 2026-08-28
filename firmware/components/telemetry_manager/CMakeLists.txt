idf_component_register(
    SRCS "telemetry_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        device_info
        system_info
        sensor_manager
        wifi_manager
        time_manager
        cjson
)