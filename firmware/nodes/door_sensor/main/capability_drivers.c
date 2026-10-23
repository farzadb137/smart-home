#include "capability_drivers.h"

#include "sensor_manager.h"

#include "driver/gpio.h"

#define CONTACT_GPIO 18

/* Reed switch wired between CONTACT_GPIO and GND. Internal pull-up holds
 * the pin HIGH when the reed's contacts are open. This assumes the
 * common "normally open" (NO) reed switch type:
 *   - Door CLOSED (magnet near)  -> contacts close -> pin pulled LOW
 *   - Door OPEN   (magnet away)  -> contacts open   -> pin reads HIGH
 * If your hardware uses a "normally closed" (NC) reed switch instead,
 * this reads inverted - flip the ternary in contact_driver_read() below
 * once confirmed on real hardware. */
static esp_err_t contact_driver_init(void){

    gpio_config_t config = {
        .pin_bit_mask = (1ULL << CONTACT_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };

    return gpio_config(&config);

}

static bool contact_driver_read(float *value){

    /* No debounce needed here: this is a periodic level sample (every
     * CAPABILITY_POLL_PERIOD_MS in sensor_manager), not an edge
     * interrupt - any mechanical bounce has long settled by the next
     * poll, so reading the steady-state level directly is correct. */
    *value = gpio_get_level(CONTACT_GPIO) ? 1.0f : 0.0f;

    return true;

}

static const capability_driver_t contact_driver = {
    .name = "contact",
    .type = CAP_TYPE_BINARY,
    .access = CAP_ACCESS_READ,
    .init = contact_driver_init,
    .read = contact_driver_read,
    .write = NULL
};

void capability_drivers_register(void){

    sensor_manager_register(&contact_driver);

}