idf_component_register(
    SRCS "telemetry_serializer.c"
    INCLUDE_DIRS "include"
    REQUIRES cjson telemetry_manager
)