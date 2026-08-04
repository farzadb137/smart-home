#include <stdio.h>
#include "device_info.h"
#include "logger.h"

#define TAG "MAIN"

void app_main(void)
{
    logger_init();

    device_info_init();

    LOG_INFO(TAG, "Device starting");

    device_info_print();

    LOG_ERROR(TAG, "Test error code=%d", -5);
}