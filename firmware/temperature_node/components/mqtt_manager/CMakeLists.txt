idf_component_register(
    SRCS "mqtt_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES logger mqtt telemetry_manager telemetry_serializer
)