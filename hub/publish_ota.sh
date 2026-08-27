#!/bin/bash
# Usage: ./publish_ota.sh <device_id_hex> <path/to/firmware.bin> <version>
set -e

DEVICE_ID="$1"
BIN_FILE="$2"
VERSION="$3"

FIRMWARE_DIR="/home/farzad/iot/collector/firmware"
HUB_HOST="192.168.1.X"   # set to your hub's LAN IP
MQTT_HOST="127.0.0.1"
COMMANDER_USER="hub_commander"

if [ -z "$DEVICE_ID" ] || [ -z "$BIN_FILE" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <device_id_hex> <path/to/firmware.bin> <version>"
    exit 1
fi

if [ ! -f "$BIN_FILE" ]; then
    echo "Error: '$BIN_FILE' not found"
    exit 1
fi

FILENAME=$(basename "$BIN_FILE")
DEST_PATH="$FIRMWARE_DIR/$FILENAME"

if [ "$(readlink -f "$BIN_FILE")" != "$(readlink -f "$DEST_PATH")" ]; then
    cp "$BIN_FILE" "$DEST_PATH"
fi

SHA256=$(sha256sum "$DEST_PATH" | awk '{print $1}')
URL="https://$HUB_HOST:5000/firmware/$FILENAME"

PAYLOAD=$(printf '{"command":"ota_update","data":{"url":"%s","version":"%s","sha256":"%s"}}' \
    "$URL" "$VERSION" "$SHA256")

echo "Target device : $DEVICE_ID"
echo "Firmware URL  : $URL"
echo "SHA-256       : $SHA256"
echo ""
read -sp "hub_commander password: " COMMANDER_PASS
echo ""

mosquitto_pub -h "$MQTT_HOST" -u "$COMMANDER_USER" -P "$COMMANDER_PASS" \
    -t "home/devices/$DEVICE_ID/command" -m "$PAYLOAD"

echo "OTA command published."