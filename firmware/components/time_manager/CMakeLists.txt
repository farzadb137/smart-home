idf_component_register(
    SRCS "src/time_manager.c"
    INCLUDE_DIRS "include"
    REQUIRES
        logger
        lwip
        esp_netif
        cjson
)