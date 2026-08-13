#include "system_info.h"

#include "esp_timer.h"
#include "esp_system.h"
#include "esp_chip_info.h"

#include <stdio.h>


static system_info_t system_info;

/*==========================================================
 * Public Functions
 *=========================================================*/

void system_info_init(void){

    esp_chip_info_t chip_info;

    esp_chip_info(&chip_info);
    switch(chip_info.model){
        case CHIP_ESP32:        system_info.chip_model = "ESP32";       break;
        case CHIP_ESP32S2:      system_info.chip_model = "ESP32-S2";    break;
        case CHIP_ESP32S3:      system_info.chip_model = "ESP32-S3";    break;
        case CHIP_ESP32C3:      system_info.chip_model = "ESP32-C3";    break;
        case CHIP_ESP32C2:      system_info.chip_model = "ESP32-C2";    break;
        case CHIP_ESP32C6:      system_info.chip_model = "ESP32-C6";    break;
        case CHIP_ESP32H2:      system_info.chip_model = "ESP32-H2";    break;
        case CHIP_ESP32P4:      system_info.chip_model = "ESP32-P4";    break;
        case CHIP_ESP32C61:     system_info.chip_model = "ESP32-C61";   break;
        case CHIP_ESP32C5:      system_info.chip_model = "ESP32-C5";    break;
        case CHIP_ESP32H21:     system_info.chip_model = "ESP32-H21";   break;
        case CHIP_ESP32H4:      system_info.chip_model = "ESP32-H4";    break;
        default:                system_info.reset_reason = "Other";     break;
    }

    switch(esp_reset_reason()){
        case ESP_RST_UNKNOWN:   system_info.reset_reason = "Unknown";                   break;
        case ESP_RST_POWERON:   system_info.reset_reason = "Power On";                  break;
        case ESP_RST_EXT:       system_info.reset_reason = "External Pin";              break;
        case ESP_RST_SW:        system_info.reset_reason = "Software Reset";            break;
        case ESP_RST_PANIC:     system_info.reset_reason = "Exception or Panic";        break;
        case ESP_RST_INT_WDT:   system_info.reset_reason = "Interrupt Watchdog";        break;
        case ESP_RST_TASK_WDT:  system_info.reset_reason = "Task Watchdog";             break;
        case ESP_RST_WDT:       system_info.reset_reason = "Watchdog Reset";            break;
        case ESP_RST_DEEPSLEEP: system_info.reset_reason = "Sleep Mode";                break;
        case ESP_RST_BROWNOUT:  system_info.reset_reason = "Brownout";                  break;
        default:                system_info.reset_reason = "Other";                     break;
    }

}


const system_info_t *system_info_get(void){

    system_info.uptime_seconds = esp_timer_get_time() / 1000000;
    system_info.free_heap = esp_get_free_heap_size();

    return &system_info;
}


void system_info_print(void){

    const system_info_t *info = system_info_get();

    printf("\n");
    printf("========== SYSTEM ==========\n");
    printf("Chip       : %s\n", info->chip_model);
    printf("Reset      : %s\n", info->reset_reason);
    printf("Uptime     : %lu s\n", info->uptime_seconds);
    printf("Free heap  : %lu bytes\n", info->free_heap);
    printf("============================\n");

}