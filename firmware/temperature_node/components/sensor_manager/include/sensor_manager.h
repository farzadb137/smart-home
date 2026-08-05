#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>


typedef struct{
    float temperature;
    uint32_t timestamp;
    bool valid;
}sensor_data_t;



void sensor_manager_init(void);
void sensor_manager_start(void);
const sensor_data_t *sensor_manager_get_data(void);



#ifdef __cplusplus
}
#endif

#endif