#ifndef TELEMETRY_SERIALIZER_H
#define TELEMETRY_SERIALIZER_H

#include "telemetry_manager.h"

char *telemetry_serializer_to_json(const telemetry_t *telemetry);

#endif