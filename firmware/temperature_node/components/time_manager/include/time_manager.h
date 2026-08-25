#ifndef TIME_MANAGER_H
#define TIME_MANAGER_H

#ifdef __cplusplus
extern "C"{
#endif

#include <stdbool.h>

/* Starts SNTP sync in the background. Safe to call before the network is up -
 * it automatically begins syncing once any network interface connects, and
 * keeps resyncing periodically after that. Does NOT block. */
void time_manager_init(void);

/* True once the device has successfully obtained real wall-clock time at
 * least once. Anything that timestamps data (e.g. offline telemetry
 * buffering) should check this before trusting time(NULL)/localtime. */
bool time_manager_is_synced(void);

#ifdef __cplusplus
}
#endif

#endif