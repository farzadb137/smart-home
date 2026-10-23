#ifndef DS18B20_H
#define DS18B20_H

#include <stdbool.h>
#include "esp_err.h"


esp_err_t ds18b20_init(int gpio_num);
bool ds18b20_read_temperature(float *temperature);


#endif