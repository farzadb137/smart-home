#include "sensor_manager.h"

#include "logger.h"
#include "ds18b20.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"

#include <string.h>

/* Physical pin the temperature probe is wired to. Node-specific - a
 * future switch/door-sensor build defines its own driver(s) with their
 * own GPIO constants instead of this one. */
#define TEMPERATURE_GPIO 18

#define CAPABILITY_POLL_PERIOD_MS 5000

static const char *TAG = "SENSOR";

static const capability_driver_t *drivers[CAPABILITY_MAX];
static capability_t values[CAPABILITY_MAX];
static size_t driver_count = 0;

static TaskHandle_t sensor_task_handle;

/*==========================================================
 * Temperature capability driver (ds18b20)
 *=========================================================*/

static esp_err_t temperature_driver_init(void){
    return ds18b20_init(TEMPERATURE_GPIO);
}

static bool temperature_driver_read(float *value){
    return ds18b20_read_temperature(value);
}

static const capability_driver_t temperature_driver = {
    .name = "temperature",
    .type = CAP_TYPE_NUMERIC,
    .access = CAP_ACCESS_READ,
    .init = temperature_driver_init,
    .read = temperature_driver_read,
    .write = NULL
};

/*==========================================================
 * Private Functions
 *=========================================================*/

static void sensor_task(void *arg){

    while(1){

        for(size_t i = 0;i < driver_count;i++){

            if(drivers[i]->read == NULL)
                continue;

            float value;
            bool ok = drivers[i]->read(&value);

            values[i].valid = ok;

            if(ok){
                values[i].value = value;
                LOG_INFO(TAG, "%s = %.2f", values[i].name, value);
            }
            else
                LOG_WARN(TAG, "Capability '%s' read failed", values[i].name);

        }

        vTaskDelay(pdMS_TO_TICKS(CAPABILITY_POLL_PERIOD_MS));

    }
}

/*==========================================================
 * Public Functions
 *=========================================================*/

esp_err_t sensor_manager_register(const capability_driver_t *driver){

    if((driver == NULL) || (driver->name == NULL))
        return ESP_ERR_INVALID_ARG;

    if(driver_count >= CAPABILITY_MAX)
        return ESP_ERR_NO_MEM;

    if(driver->init != NULL){
        esp_err_t err = driver->init();
        if(err != ESP_OK){
            LOG_ERROR(TAG, "Failed to init capability driver '%s': %s", driver->name, esp_err_to_name(err));
            return err;
        }
    }

    drivers[driver_count] = driver;

    strncpy(values[driver_count].name, driver->name, sizeof(values[driver_count].name) - 1);
    values[driver_count].name[sizeof(values[driver_count].name) - 1] = '\0';
    values[driver_count].type = driver->type;
    values[driver_count].access = driver->access;
    values[driver_count].value = 0;
    values[driver_count].valid = false;

    driver_count++;

    LOG_INFO(TAG, "Registered capability driver '%s'", driver->name);

    return ESP_OK;
}

void sensor_manager_init(void){

    driver_count = 0;
    memset(values, 0, sizeof(values));

    /* This node build exposes one capability: temperature. A future
     * switch or door-sensor build registers its own driver(s) here
     * instead. */
    sensor_manager_register(&temperature_driver);

    LOG_INFO(TAG, "Sensor manager initialized with %d capability driver(s)", (int)driver_count);

    xTaskCreate(sensor_task, "sensor_task", 4096, NULL, 5, &sensor_task_handle);

}

size_t sensor_manager_get_capabilities(capability_t *out, size_t max){

    if(out == NULL)
        return 0;

    size_t count = (driver_count < max) ? driver_count : max;

    memcpy(out, values, count * sizeof(capability_t));

    return count;
}

esp_err_t sensor_manager_set_capability(const char *name, float value){

    if(name == NULL)
        return ESP_ERR_INVALID_ARG;

    for(size_t i = 0;i < driver_count;i++){

        if(strcmp(drivers[i]->name, name) != 0)
            continue;

        if(drivers[i]->write == NULL)
            return ESP_ERR_NOT_SUPPORTED;

        esp_err_t err = drivers[i]->write(value);

        if(err == ESP_OK){
            values[i].value = value;
            values[i].valid = true;
        }

        return err;
    }

    return ESP_ERR_NOT_FOUND;
}