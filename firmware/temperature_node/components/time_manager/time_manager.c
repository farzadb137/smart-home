#include "time_manager.h"

#include "logger.h"

#include "esp_netif_sntp.h"
#include "esp_sntp.h"

#include <time.h>

static const char *TAG = "TIME";

/* Our own latch, set once inside time_sync_notification_cb and never
 * cleared. This is deliberately NOT the same thing as querying
 * sntp_get_sync_status() on every call - that status is transient (it
 * can report "in progress" or "reset" during a later periodic resync)
 * even though the clock itself remains correctly set from the last
 * successful sync. "Has this device ever obtained real time" is the
 * question we actually need answered, and this callback firing is the
 * ground truth for that. */
static volatile bool time_synced = false;

/*==========================================================
 * Private Functions
 *=========================================================*/

static void time_sync_notification_cb(struct timeval *tv){

    time_synced = true;

    time_t now = tv->tv_sec;
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);

    char buf[32];
    strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S", &timeinfo);

    LOG_INFO(TAG, "Time synchronized: %s UTC", buf);

}

/*==========================================================
 * Public Functions
 *=========================================================*/

void time_manager_init(void){

    /* ESP_NETIF_SNTP_DEFAULT_CONFIG sets this up to start automatically
     * once any netif comes up, and to keep resyncing periodically after
     * that - no manual retry/backoff logic needed on our side. */
    esp_sntp_config_t config = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    config.sync_cb = time_sync_notification_cb;

    esp_netif_sntp_init(&config);

    LOG_INFO(TAG, "SNTP configured, will sync once network is available");

}

bool time_manager_is_synced(void){

    return time_synced;

}