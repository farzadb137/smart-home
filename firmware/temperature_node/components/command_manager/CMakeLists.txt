idf_component_register(
    SRCS "command_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES logger config_manager cjson wifi_manager mqtt_manager esp_timer
)