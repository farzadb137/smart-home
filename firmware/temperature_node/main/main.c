#include <stdio.h>
#include "device_info.h"

void app_main(void)
{
    device_info_init();

    device_info_print();
}