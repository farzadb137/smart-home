idf_component_register(
    SRCS "app_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES logger telemetry_manager telemetry_serializer mqtt_manager topic_manager cjson
)