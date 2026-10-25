idf_component_register(
    SRCS "src/led_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES logger led_strip
)