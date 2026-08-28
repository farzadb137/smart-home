#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#ifdef __cplusplus
extern "C"{
#endif

#include "esp_err.h"
#include <stdbool.h>

typedef void (*ota_status_callback_t)(bool success, const char *message);

/* Starts OTA update in a background task - non-blocking, returns
 * immediately. expected_sha256_hex is a 64-char hex SHA-256 digest
 * checked against the downloaded image BEFORE it's ever set as the
 * boot partition - a mismatch aborts the OTA, current firmware
 * keeps running untouched. callback fires once with the result;
 * it is NOT called on success, since the device reboots to apply
 * the update before any response could meaningfully be delivered. */
esp_err_t ota_manager_start(const char *url, const char *expected_sha256_hex, ota_status_callback_t callback);

/* Call once MQTT is confirmed connected. Tells the bootloader this
 * image is good, cancelling the rollback timer. No-op if there's
 * nothing pending. */
void ota_manager_confirm_valid(void);

#ifdef __cplusplus
}
#endif

#endif