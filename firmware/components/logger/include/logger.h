#ifndef LOGGER_H
#define LOGGER_H

#ifdef __cplusplus
extern "C"{
#endif

typedef enum{
    LOG_LEVEL_DEBUG,
    LOG_LEVEL_INFO,
    LOG_LEVEL_WARNING,
    LOG_LEVEL_ERROR
}log_level_t;

void logger_init(void);

void logger_log(log_level_t level, const char *tag, const char *format, ...);

#define LOG_DEBUG(tag, format, ...) \
    logger_log(LOG_LEVEL_DEBUG, tag, format, ##__VA_ARGS__)


#define LOG_INFO(tag, format, ...) \
    logger_log(LOG_LEVEL_INFO, tag, format, ##__VA_ARGS__)


#define LOG_WARN(tag, format, ...) \
    logger_log(LOG_LEVEL_WARNING, tag, format, ##__VA_ARGS__)


#define LOG_ERROR(tag, format, ...) \
    logger_log(LOG_LEVEL_ERROR, tag, format, ##__VA_ARGS__)


#ifdef __cplusplus
}
#endif

#endif