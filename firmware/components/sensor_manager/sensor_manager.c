#include "sensor_manager.h"

#include "logger.h"

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <string.h>

#define CAPABILITY_POLL_PERIOD_MS 5000

static const char *TAG = "SENSOR";

static const capability_driver_t *drivers[CAPABILITY_MAX];
static capability_t values[CAPABILITY_MAX];
static size_t driver_count = 0;

static TaskHandle_t sensor_task_handle;

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

    /* Deliberately registers nothing itself - this component is shared
     * across every node type now. Each node's main/capability_drivers.c
     * calls sensor_manager_register() for whatever hardware that
     * specific product actually has, right after this returns. */

    xTaskCreate(sensor_task, "sensor_task", 4096, NULL, 5, &sensor_task_handle);

    LOG_INFO(TAG, "Sensor manager initialized (generic registry)");

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