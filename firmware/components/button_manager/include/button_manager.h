#ifndef BUTTON_MANAGER_H
#define BUTTON_MANAGER_H

#ifdef __cplusplus
extern "C"{
#endif

#include "esp_err.h"

esp_err_t button_manager_init(int gpio_num);

#ifdef __cplusplus
}
#endif

#endif