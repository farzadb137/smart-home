#include "ds18b20.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "driver/rmt_tx.h"
#include "driver/rmt_rx.h"
#include <string.h>

#define ONEWIRE_RESOLUTION_HZ   1000000

//ROM Function Commands
#define DS18B20_COMMAND_READ_ROM                0x33
#define DS18B20_COMMAND_MATCH_ROM               0x55
#define DS18B20_COMMAND_SKIP_ROM                0xCC
#define DS18B20_COMMAND_SEARCH_ROM              0xF0
#define DS18B20_COMMAND_ALARM_SEARCH            0xEC

//Memory Function Commands
#define DS18B20_COMMAND_CONVERT_T               0x44
#define DS18B20_COMMAND_WRITE_SCRATCHPAD        0x4E
#define DS18B20_COMMAND_READ_SCRATCHPAD         0xBE
#define DS18B20_COMMAND_COPY_SCRATCHPAD         0x48
#define DS18B20_COMMAND_RECALL_E2               0xB8
#define DS18B20_COMMAND_READ_POWER              0xB4

static rmt_channel_handle_t tx_chan;
static rmt_channel_handle_t rx_chan;
static rmt_encoder_handle_t copy_encoder = NULL;
static rmt_encoder_handle_t bytes_encoder = NULL;

static QueueHandle_t rx_queue;

/*==========================================================
 * Private Functions
 *=========================================================*/

static bool ds18b20_rx_done_cb(rmt_channel_handle_t channel , const rmt_rx_done_event_data_t *edata , void *user_data){

    BaseType_t woken = pdFALSE;
    xQueueSendFromISR((QueueHandle_t)user_data , edata , &woken);
    return woken == pdTRUE;

}

static esp_err_t ds18b20_reset_presence(bool *presence){

    esp_err_t err;
    *presence = false;

    rmt_symbol_word_t rx_symbols[10];
    rmt_receive_config_t rx_config = {
        .signal_range_min_ns = 1000,
        .signal_range_max_ns = 1000000
    };
    err = rmt_receive(rx_chan, rx_symbols, sizeof(rx_symbols), &rx_config);
    if(err != ESP_OK)
        return err;

    rmt_transmit_config_t tx_config = {
        .loop_count = 0,
        .flags.eot_level = 1
    };
    rmt_symbol_word_t reset_pulse = {
        .level0 = 0, .duration0 = 480,
        .level1 = 1, .duration1 = 70
    };
    err = rmt_transmit(tx_chan, copy_encoder, &reset_pulse, sizeof(reset_pulse), &tx_config);
    if(err != ESP_OK)
        return err;

    err = rmt_tx_wait_all_done(tx_chan, portMAX_DELAY);
    if(err != ESP_OK)
        return err;

    rmt_rx_done_event_data_t rx_data;
    if(xQueueReceive(rx_queue, &rx_data, pdMS_TO_TICKS(10)) != pdTRUE)
        return ESP_FAIL;

    if(rx_data.num_symbols >= 2)
        *presence = true;

    return ESP_OK;
}

static esp_err_t ds18b20_write_byte(uint8_t data){

    rmt_transmit_config_t tx_config = {
        .loop_count = 0,
        .flags.eot_level = 1
    };
    esp_err_t err = rmt_transmit(tx_chan, bytes_encoder, &data, sizeof(data), &tx_config);
    if(err != ESP_OK)
        return err;

    err = rmt_tx_wait_all_done(tx_chan, portMAX_DELAY);
    if(err != ESP_OK)
        return err;

    return ESP_OK;
}

static void ds18b20_decode_bytes(const rmt_symbol_word_t *symbols, uint8_t symbol_count, uint8_t *data, uint8_t data_count){

    memset(data, 0, data_count);
    for(uint8_t i = 0;(i < symbol_count) && ((i / 8) < data_count);i++)
        if(symbols[i].duration0 < 15)
            data[i / 8] |= (1 << (i % 8));

}

static esp_err_t ds18b20_read_bytes(uint8_t *data, uint8_t count){

    esp_err_t err;

    rmt_symbol_word_t rx_symbols[count * 8];
    rmt_receive_config_t rx_config = {
        .signal_range_min_ns = 1000,
        .signal_range_max_ns = 1000000
    };
    err = rmt_receive(rx_chan, rx_symbols, sizeof(rx_symbols), &rx_config);
    if(err != ESP_OK)
        return err;

    uint8_t read_clock[count];
    memset(read_clock, 0xFF, count);
    
    rmt_transmit_config_t tx_config = {
        .loop_count = 0,
        .flags.eot_level = 1
    };
    err = rmt_transmit(tx_chan, bytes_encoder, &read_clock, count, &tx_config);
    if(err != ESP_OK)
        return err;

    rmt_rx_done_event_data_t rx_data;
    if(xQueueReceive(rx_queue, &rx_data, pdMS_TO_TICKS(50)) != pdTRUE)
        return ESP_FAIL;
    
    ds18b20_decode_bytes(rx_data.received_symbols , rx_data.num_symbols , data , count);

    return ESP_OK;
}

static uint8_t ds18b20_crc8(const uint8_t *data, uint8_t len){

    uint8_t crc = 0;
    for(uint8_t i = 0;i < len;i++){
        crc ^= data[i];
        for(uint8_t bit = 0;bit < 8;bit++)
            if(crc & 0x01)
                crc = (crc >> 1) ^ 0x8C;
            else
                crc >>= 1;
    }

    return crc;
}

static esp_err_t ds18b20_start_conversion(void){

    bool ready;

    if((ds18b20_reset_presence(&ready) != ESP_OK) || (ready == false))
        return ESP_FAIL;

    if(ds18b20_write_byte(DS18B20_COMMAND_SKIP_ROM) != ESP_OK)
        return ESP_FAIL;

    if(ds18b20_write_byte(DS18B20_COMMAND_CONVERT_T) != ESP_OK)
        return ESP_FAIL;

    return ESP_OK;
}

static esp_err_t ds18b20_read_scratchpad(uint8_t *scratchpad){

    bool ready;

    if((ds18b20_reset_presence(&ready) != ESP_OK) || (ready == false))
        return ESP_FAIL;

    if(ds18b20_write_byte(DS18B20_COMMAND_SKIP_ROM) != ESP_OK)
        return ESP_FAIL;

    if(ds18b20_write_byte(DS18B20_COMMAND_READ_SCRATCHPAD) != ESP_OK)
        return ESP_FAIL;

    if(ds18b20_read_bytes(scratchpad, 9) != ESP_OK)
        return ESP_FAIL;

    if(ds18b20_crc8(scratchpad, 8) != scratchpad[8])
        return ESP_FAIL;

    return ESP_OK;
}

/*==========================================================
 * Public Functions
 *=========================================================*/

esp_err_t ds18b20_init(int gpio_num){

    esp_err_t err;

    rmt_tx_channel_config_t tx_chan_conf = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .gpio_num = gpio_num,
        .mem_block_symbols = 48,
        .resolution_hz = ONEWIRE_RESOLUTION_HZ,
        .trans_queue_depth = 4,
        .flags.init_level = 1
    };
    err = rmt_new_tx_channel(&tx_chan_conf, &tx_chan);
    if(err != ESP_OK)
        return err;

    err = gpio_od_enable(gpio_num);
    if(err != ESP_OK)
        return err;

    rmt_rx_channel_config_t rx_chan_conf = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .gpio_num = gpio_num,
        .mem_block_symbols = 48,
        .resolution_hz = ONEWIRE_RESOLUTION_HZ
    };
    err = rmt_new_rx_channel(&rx_chan_conf, &rx_chan);
    if(err != ESP_OK)
        return err;

    rx_queue = xQueueCreate(1, sizeof(rmt_rx_done_event_data_t));
    rmt_rx_event_callbacks_t rx_cbs = {.on_recv_done = ds18b20_rx_done_cb};
    err = rmt_rx_register_event_callbacks(rx_chan, &rx_cbs, rx_queue);
    if(err != ESP_OK)
        return err;

    err = rmt_enable(tx_chan);
    if(err != ESP_OK)
        return err;

    err = rmt_enable(rx_chan);
    if(err != ESP_OK)
        return err;

    rmt_copy_encoder_config_t copy_encoder_config = {};
    err = rmt_new_copy_encoder(&copy_encoder_config, &copy_encoder);
    if(err != ESP_OK)
        return err;

    rmt_bytes_encoder_config_t bytes_encoder_config = {
        .bit0 = {.level0 = 0, .duration0 = 60, .level1 = 1, .duration1 = 10},
        .bit1 = {.level0 = 0, .duration0 = 6 , .level1 = 1, .duration1 = 64},
        .flags.msb_first = 0
    };
    err = rmt_new_bytes_encoder(&bytes_encoder_config, &bytes_encoder);
    if(err != ESP_OK)
        return err;
    
    return ESP_OK;
}

bool ds18b20_read_temperature(float *temperature){

    uint8_t scratchpad[9];

    if(ds18b20_start_conversion() != ESP_OK)
        return false;

    vTaskDelay(pdMS_TO_TICKS(750));

    if(ds18b20_read_scratchpad(scratchpad) != ESP_OK)
        return false;

    int16_t raw = (scratchpad[1] << 8) | scratchpad[0];

    *temperature = raw / 16.0f;

    return true;
}