#include <stdio.h>
#include "device_info.h"
#include "logger.h"
#include "system_info.h"

#define TAG "MAIN"

void app_main(void)
{
    logger_init();

    device_info_init();

    system_info_init();

    LOG_INFO(TAG, "Device starting");

    device_info_print();

    system_info_print();
}