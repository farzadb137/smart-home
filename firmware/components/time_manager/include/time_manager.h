#ifndef TIME_MANAGER_H
#define TIME_MANAGER_H

#ifdef __cplusplus
extern "C"{
#endif

#include <stdbool.h>

void time_manager_init(void);

void time_manager_handle_sync(const char *payload, int length);

bool time_manager_is_synced(void);

#ifdef __cplusplus
}
#endif

#endif