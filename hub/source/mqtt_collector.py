import json
import threading
import time

import paho.mqtt.client as mqtt

from config import (
    BROKER_HOST,
    BROKER_PORT,
    BROKER_USERNAME,
    BROKER_PASSWORD,
    TELEMETRY_TOPIC,
    STATUS_TOPIC,
    CHILD_TELEMETRY_TOPIC,
    CHILD_STATUS_TOPIC
)
from database import (
    migrate_database,
    get_or_create_device,
    save_reading,
    update_device_status,
    mark_offline_devices
)

TIME_SYNC_TOPIC = "home/time"
TIME_SYNC_INTERVAL_SEC = 60
OFFLINE_TIMEOUT_SEC = 30
OFFLINE_CHECK_INTERVAL_SEC = 5

mqtt_connected = threading.Event()

def offline_monitor():
    while True:
        try:
            mark_offline_devices(OFFLINE_TIMEOUT_SEC)
        except Exception as error:
            print(f"[DB] Offline monitor error: {error}")
        time.sleep(OFFLINE_CHECK_INTERVAL_SEC)

def time_sync_publisher(client):
    while True:
        mqtt_connected.wait()
        try:
            payload = json.dumps({"epoch": int(time.time())})
            client.publish(TIME_SYNC_TOPIC, payload, qos=1, retain=True)
        except Exception as error:
            print(f"[MQTT] Time sync publish error: {error}")
        time.sleep(TIME_SYNC_INTERVAL_SEC)

def _parse_topic(topic):
    parts = topic.split("/")

    if len(parts) == 4 and parts[0] == "home" and parts[1] == "devices" and parts[3] in ("telemetry", "status"):
        return parts[3], parts[2], None

    if len(parts) == 6 and parts[0] == "home" and parts[1] == "devices" and parts[3] == "children" and parts[5] in ("telemetry", "status"):
        return parts[5], parts[4], parts[2]

    return None, None, None

def handle_status(message, parent_hardware_id=None):
    try:
        payload = json.loads(message.payload.decode())
    except json.JSONDecodeError:
        print("[MQTT] Invalid status JSON")
        return

    hardware_id = payload.get("id")
    online = payload.get("online", False)
    uptime = payload.get("uptime")
    rssi = payload.get("rssi")
    if hardware_id is None:
        return

    parent_device_id = get_or_create_device(parent_hardware_id) if parent_hardware_id is not None else None

    update_device_status(hardware_id, online, rssi, uptime, parent_device_id)

    via = f" via={parent_hardware_id:012X}" if parent_hardware_id is not None else ""
    print(f"[STATUS] id={hardware_id} online={online} rssi={rssi} uptime={uptime}{via}")

def handle_telemetry(message, parent_hardware_id=None):
    try:
        payload = json.loads(message.payload.decode())
    except json.JSONDecodeError:
        print("[MQTT] Invalid telemetry JSON")
        return

    device = payload.get("device", {})
    system = payload.get("system", {})
    capabilities = payload.get("capabilities", {})

    hardware_id = device.get("id")
    device_name = device.get("name")
    device_type = device.get("type")
    firmware = device.get("firmware")

    rssi = system.get("rssi")
    uptime = system.get("uptime")
    time_valid = system.get("time_valid", False)
    device_timestamp = system.get("timestamp") if time_valid else None

    print(f"Device:       {device_name}")
    print(f"Firmware:     {firmware}")
    print(f"Capabilities: {list(capabilities.keys())}")
    print(f"RSSI:         {rssi} dBm")
    print(f"Uptime:       {uptime} s")

    if parent_hardware_id is not None:
        print(f"Via bridge:   {parent_hardware_id:012X}")

    if not time_valid:
        print("[WARN] Device has not synced time yet - recording collector-side timestamp instead")

    try:
        parent_device_id = get_or_create_device(parent_hardware_id) if parent_hardware_id is not None else None
        device_id = get_or_create_device(hardware_id, device_name, device_type, firmware, parent_device_id)
        for capability_name, reading in capabilities.items():
            save_reading(device_id, capability_name, reading.get("value"), reading.get("valid"), rssi, uptime, device_timestamp)
        print(f"[DB] Reading(s) saved(device_id={device_id})")
    except Exception as error:
        print(f"[DB] Failed to save reading: {error}")

def on_connect(client, userdata, flags, reason_code, properties):
    print(f"[MQTT] Connected: {reason_code}")

    subscriptions = (
        TELEMETRY_TOPIC,
        STATUS_TOPIC,
        CHILD_TELEMETRY_TOPIC,
        CHILD_STATUS_TOPIC
    )
    for topic in subscriptions:
        client.subscribe(topic)
        print(f"[MQTT] Subscribed to: {topic}")
    
    mqtt_connected.set()

def on_disconnect(client, userdata, flags, reason_code, properties):
    mqtt_connected.clear()

def on_message(client, userdata, message):
    print(
        f"[MQTT RAW] topic={message.topic} "
        f"payload={message.payload!r}"
    )
    kind, hardware_id_hex, parent_hardware_id_hex = _parse_topic(message.topic)
    if kind is None:
        return

    parent_hardware_id = int(parent_hardware_id_hex, 16) if parent_hardware_id_hex else None

    if kind == "status":
        handle_status(message, parent_hardware_id)
    elif kind == "telemetry":
        handle_telemetry(message, parent_hardware_id)

def create_mqtt_client():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.username_pw_set(BROKER_USERNAME, BROKER_PASSWORD)
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    return client

def start_background_tasks(client):
    threading.Thread(target=offline_monitor, name="offline_monitor", daemon=True).start()
    threading.Thread(target=time_sync_publisher, args=(client,), name="time_sync_publisher", daemon=True).start()

def main():
    migrate_database()

    client = create_mqtt_client()
    start_background_tasks(client)
    print("[MQTT] Connecting to broker...")
    client.connect(BROKER_HOST, BROKER_PORT, 60)
    client.loop_forever()

if __name__ == "__main__":
    main()