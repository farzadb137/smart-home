idf_component_register(
    SRCS "button_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        logger
        esp_driver_gpio
        esp_timer
        config_manager
)