idf_component_register(
    SRCS "provision_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        led_manager
        logger
        esp_wifi
        device_info
        esp_http_server
        config_manager
        lwip
)