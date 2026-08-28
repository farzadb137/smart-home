#include "time_manager.h"

#include "logger.h"

#include "esp_netif_sntp.h"
#include "esp_sntp.h"

#include "cJSON.h"

#include <time.h>
#include <sys/time.h>

static const char *TAG = "TIME";

/* Our own latch, set once from either sync path and never cleared. This
 * is deliberately NOT the same thing as querying sntp_get_sync_status()
 * on every call - that status is transient (it can report "in progress"
 * or "reset" during a later periodic resync) even though the clock
 * itself remains correctly set from the last successful sync. "Has this
 * device ever obtained real time" is the question we actually need
 * answered, and either callback firing is ground truth for that. */
static volatile bool time_synced = false;

/*==========================================================
 * Private Functions
 *=========================================================*/

static void log_synced_time(const char *source, time_t now){

    struct tm timeinfo;
    localtime_r(&now, &timeinfo);

    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);

    LOG_INFO(TAG, "Time synchronized via %s: %s UTC", source, buf);

}

static void time_sync_notification_cb(struct timeval *tv){

    time_synced = true;

    log_synced_time("SNTP", tv->tv_sec);

}

/*==========================================================
 * Public Functions
 *=========================================================*/

void time_manager_init(void){

    /* Secondary path: harmless if this network has no internet route
     * (it simply never succeeds), free extra robustness on networks
     * that do. Primary path is time_manager_handle_sync() below. */
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    config.sync_cb = time_sync_notification_cb;

    esp_netif_sntp_init(&config);

    LOG_INFO(TAG, "SNTP configured (secondary), will sync once network is available");

}

void time_manager_handle_sync(const char *payload, int length){

    cJSON *root = cJSON_ParseWithLength(payload, length);
    if(root == NULL){
        LOG_WARN(TAG, "Invalid time sync payload");
        return;
    }

    cJSON *epoch = cJSON_GetObjectItem(root, "epoch");
    if((epoch == NULL) || !cJSON_IsNumber(epoch)){
        LOG_WARN(TAG, "Time sync payload missing 'epoch'");
        cJSON_Delete(root);
        return;
    }

    struct timeval tv = { .tv_sec = (time_t)epoch->valuedouble, .tv_usec = 0 };
    settimeofday(&tv, NULL);

    time_synced = true;

    log_synced_time("MQTT (hub)", tv.tv_sec);

    cJSON_Delete(root);

}

bool time_manager_is_synced(void){

    return time_synced;

}