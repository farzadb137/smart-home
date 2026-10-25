#include "capability_drivers.h"

#include "sensor_manager.h"
#include "ds18b20.h"

#define TEMPERATURE_GPIO 18

static esp_err_t temperature_driver_init(void){
    return ds18b20_init(TEMPERATURE_GPIO);
}

static bool temperature_driver_read(float *value){
    return ds18b20_read_temperature(value);
}

static const capability_driver_t temperature_driver = {
    .name = "temperature",
    .type = CAP_TYPE_NUMERIC,
    .access = CAP_ACCESS_READ,
    .init = temperature_driver_init,
    .read = temperature_driver_read,
    .write = NULL
};

void capability_drivers_register(void){

    sensor_manager_register(&temperature_driver);

}