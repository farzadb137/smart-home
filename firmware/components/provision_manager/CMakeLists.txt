idf_component_register(
    SRCS "provision_manager.c"
    INCLUDE_DIRS "include"
    EMBED_TXTFILES "certs/hub_ca_cert.pem"
    REQUIRES
        led_manager
        logger
        esp_wifi
        device_info
        esp_http_server
        esp_http_client
        config_manager
        lwip
        cjson
        mdns
)