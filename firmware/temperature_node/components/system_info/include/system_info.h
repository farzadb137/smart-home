#ifndef SYSTEM_INFO_H
#define SYSTEM_INFO_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

typedef struct
{
    uint32_t uptime_seconds;
    uint32_t free_heap;
    const char *reset_reason;
    const char *chip_model;
} system_info_t;


void system_info_init(void);
const system_info_t *system_info_get(void);
void system_info_print(void);


#ifdef __cplusplus
}
#endif

#endif