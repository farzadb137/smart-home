#include "logger.h"

#include "stdio.h"
#include "stdarg.h"

static const char *level_to_string(log_level_t level){

    switch(level){
        case LOG_LEVEL_DEBUG:   return "DEBUG";
        case LOG_LEVEL_INFO:    return "INFO";
        case LOG_LEVEL_WARNING: return "WARN";
        case LOG_LEVEL_ERROR:   return "ERROR";
        default:                return "UNKNOWN";
    }

}

void logger_init(void){

}

void logger_log(log_level_t level, const char *tag, const char *format, ...){

    va_list args;

    printf("[%s] %s: ", level_to_string(level), tag);

    va_start(args, format);
    vprintf(format, args);
    va_end(args);

    printf("\n");

}