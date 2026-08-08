idf_component_register(
    SRCS "mqtt_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES logger config_manager mqtt telemetry_manager telemetry_serializer topic_manager command_manager
)