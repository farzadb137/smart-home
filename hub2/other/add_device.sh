#!/bin/bash
# ============================================================
# EMERGENCY / MANUAL FALLBACK ONLY.
#
# Normal device onboarding goes through the dashboard's "Add Device"
# flow (/add-device -> claim code -> device self-provisions over
# HTTPS). See api.py's /api/provision/start and /api/provision/claim
# routes - that's the authoritative path as of Phase 1.
#
# This script exists only as a manual escape hatch for the case where
# the dashboard/API itself is broken but you still have SSH access to
# the hub and need to issue MQTT credentials directly.
# ============================================================
# Usage: ./add_device.sh <device_id_hex>
#
# <device_id_hex> is the device's own hardware-derived identity - the SAME
# 12-character hex string shown in its provisioning AP name
# (e.g. "SmartTemp-Setup-A3F2E1B09C44" -> use "A3F2E1B09C44").
#
# This is deliberately NOT a free-typed friendly name. The value you pass
# here becomes the MQTT username, which the broker's ACL (%u pattern) uses
# to scope which topics this device may publish/subscribe to - and the
# device's firmware independently builds its own topics from this same ID.
# If this doesn't match the device's actual ID, the device's own
# provisioning form will refuse the submission and tell the installer the
# correct value to use - so a mismatch here just means re-provisioning,
# not a silent broken state.
#
# Re-running this for an ID that already has credentials (e.g. after a
# factory reset) is expected and safe - mosquitto_passwd overwrites the
# existing entry in place with a fresh password.
set -e

DEVICE_ID="$1"
PASSWD_FILE="/etc/mosquitto/passwd"

if [ -z "$DEVICE_ID" ]; then
    echo "Usage: $0 <device_id_hex>"
    echo "  <device_id_hex> is the 12-char hex ID shown in the device's"
    echo "  setup AP name, e.g. SmartTemp-Setup-A3F2E1B09C44 -> A3F2E1B09C44"
    exit 1
fi

# Light sanity check, not a hard requirement - catches an obvious typo
# (wrong length, stray characters) before it costs a round trip to the
# device's captive portal, which will reject a mismatched value anyway.
if ! [[ "$DEVICE_ID" =~ ^[0-9A-Fa-f]{12}$ ]]; then
    echo "Warning: '$DEVICE_ID' doesn't look like a 12-character hex device ID."
    echo "Expected something like: A3F2E1B09C44"
    read -p "Continue anyway? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# mosquitto stores usernames as given - normalize to uppercase so it always
# matches what device_info_get_id_hex() produces on the firmware side
# (%012llX is uppercase), regardless of how the installer typed it.
DEVICE_ID_UPPER=$(echo "$DEVICE_ID" | tr '[:lower:]' '[:upper:]')

# Generate a random 24-char password
PASSWORD=$(openssl rand -base64 18)

# mosquitto_passwd creates the file on first use, appends/overwrites after.
# Overwriting an existing entry (e.g. re-adding after a factory reset) is
# expected and safe - it's a normal path, not an edge case.
if [ -f "$PASSWD_FILE" ]; then
    mosquitto_passwd -b "$PASSWD_FILE" "$DEVICE_ID_UPPER" "$PASSWORD"
else
    mosquitto_passwd -c -b "$PASSWD_FILE" "$DEVICE_ID_UPPER" "$PASSWORD"
fi

systemctl reload mosquitto

echo ""
echo "Device ID: $DEVICE_ID_UPPER"
echo "Password:  $PASSWORD"
echo "Enter these into the device's provisioning form (MQTT Username / MQTT Password)."
echo "The username field MUST be exactly: $DEVICE_ID_UPPER"