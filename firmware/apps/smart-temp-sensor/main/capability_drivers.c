#include "capability_drivers.h"

#include "sensor_manager.h"
#include "ds18b20.h"
#include "bsp.h"

static esp_err_t temperature_driver_init(void){
    return ds18b20_init(BSP_TEMP_GPIO);
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