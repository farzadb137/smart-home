idf_component_register(
    SRCS "src/topic_manager.c"
    INCLUDE_DIRS "include" "../../../protocol/generated"
    REQUIRES device_info
)