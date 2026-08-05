#include "ds18b20.h"

#include "driver/gpio.h"
#include "esp_rom_sys.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#define DS18B20_SKIP_ROM        0xCC
#define DS18B20_CONVERT_T       0x44
#define DS18B20_READ_SCRATCHPAD 0xBE

static int ds18b20_gpio_num;

esp_err_t ds18b20_init(int gpio_num){

    ds18b20_gpio_num = gpio_num;

    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << gpio_num),
        .mode = GPIO_MODE_INPUT_OUTPUT_OD,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    return gpio_config(&io_conf);
}

static bool onewire_reset(void){

    bool presence;

    // Drive bus low
    gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_OUTPUT_OD);
    gpio_set_level(ds18b20_gpio_num, 0);

    // Reset pulse
    esp_rom_delay_us(480);

    // Release bus
    gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_INPUT);

    // Wait for slave response window
    esp_rom_delay_us(70);

    // Read presence pulse
    presence = (gpio_get_level(ds18b20_gpio_num) == 0);

    // Finish reset timing
    esp_rom_delay_us(410);

    return presence;
}

static void onewire_write_bit(bool bit){

    gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_OUTPUT_OD);

    if(bit){
        // Write 1
        gpio_set_level(ds18b20_gpio_num, 0);
        esp_rom_delay_us(6);
        gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_INPUT);
        esp_rom_delay_us(54);
    }
    else{
        // Write 0
        gpio_set_level(ds18b20_gpio_num, 0);
        esp_rom_delay_us(60);
        gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_INPUT);
        esp_rom_delay_us(10);
    }
}

static bool onewire_read_bit(void){

    bool bit;

    gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_OUTPUT_OD);

    // Start read slot
    gpio_set_level(ds18b20_gpio_num, 0);
    esp_rom_delay_us(6);

    // Release bus
    gpio_set_direction(ds18b20_gpio_num, GPIO_MODE_INPUT);

    // Wait for slave response
    esp_rom_delay_us(9);

    // Sample
    bit = gpio_get_level(ds18b20_gpio_num);

    // Finish time slot
    esp_rom_delay_us(55);

    return bit;
}

static void onewire_write_byte(uint8_t data){

    for(uint8_t i = 0; i < 8; i++){
        onewire_write_bit(data & 0x01);
        data >>= 1;
    }
}

static uint8_t onewire_read_byte(void){

    uint8_t data = 0;

    for(uint8_t i = 0; i < 8; i++)
        if(onewire_read_bit())
            data |= (1 << i);

    return data;
}

static bool ds18b20_start_conversion(void){

    if(!onewire_reset())
        return false;

    onewire_write_byte(DS18B20_SKIP_ROM);
    onewire_write_byte(DS18B20_CONVERT_T);

    return true;
}

bool ds18b20_read_temperature(float *temperature){

    uint8_t lsb;
    uint8_t msb;

    if(!ds18b20_start_conversion())
        return false;

    vTaskDelay(pdMS_TO_TICKS(750));

    if(!onewire_reset())
        return false;

    onewire_write_byte(DS18B20_SKIP_ROM);
    onewire_write_byte(DS18B20_READ_SCRATCHPAD);

    lsb = onewire_read_byte();
    msb = onewire_read_byte();

    int16_t raw = (msb << 8) | lsb;

    *temperature = raw / 16.0f;

    return true;
}