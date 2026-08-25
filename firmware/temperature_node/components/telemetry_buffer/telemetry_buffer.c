#include "telemetry_buffer.h"

#include <string.h>

typedef struct{
    telemetry_t entries[TELEMETRY_BUFFER_CAPACITY];
    size_t head;    /* index of the oldest entry */
    size_t count;
}telemetry_buffer_t;

static telemetry_buffer_t buffer;

/*==========================================================
 * Public Functions
 *=========================================================*/

void telemetry_buffer_init(void){

    memset(&buffer, 0, sizeof(buffer));

}

bool telemetry_buffer_push(const telemetry_t *entry){

    if(entry == NULL)
        return false;

    bool evicted = false;

    if(buffer.count == TELEMETRY_BUFFER_CAPACITY){
        /* Full: drop the oldest to make room for the newest reading.
         * Recency over completeness - see header comment for rationale. */
        buffer.head = (buffer.head + 1) % TELEMETRY_BUFFER_CAPACITY;
        buffer.count--;
        evicted = true;
    }

    size_t tail = (buffer.head + buffer.count) % TELEMETRY_BUFFER_CAPACITY;
    buffer.entries[tail] = *entry;
    buffer.count++;

    return !evicted;
}

bool telemetry_buffer_peek(telemetry_t *out){

    if((out == NULL) || (buffer.count == 0))
        return false;

    *out = buffer.entries[buffer.head];

    return true;
}

bool telemetry_buffer_pop(void){

    if(buffer.count == 0)
        return false;

    buffer.head = (buffer.head + 1) % TELEMETRY_BUFFER_CAPACITY;
    buffer.count--;

    return true;
}

size_t telemetry_buffer_count(void){

    return buffer.count;

}