#ifndef TELEMETRY_BUFFER_H
#define TELEMETRY_BUFFER_H

#ifdef __cplusplus
extern "C"{
#endif

#include "telemetry_manager.h"
#include <stdbool.h>
#include <stddef.h>

#define TELEMETRY_BUFFER_CAPACITY 30

void telemetry_buffer_init(void);
bool telemetry_buffer_push(const telemetry_t *entry);
bool telemetry_buffer_peek(telemetry_t *out);
bool telemetry_buffer_pop(void);
size_t telemetry_buffer_count(void);

#ifdef __cplusplus
}
#endif

#endif