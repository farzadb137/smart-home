import json
import paho.mqtt.client as mqtt
import threading
import time
from config import(BROKER_HOST,BROKER_PORT,BROKER_USERNAME,BROKER_PASSWORD,TELEMETRY_TOPIC,STATUS_TOPIC)
from database import(migrate_database,get_or_create_device,save_reading,update_device_status,mark_offline_devices)

TIME_SYNC_TOPIC = "home/time"
TIME_SYNC_INTERVAL_SEC = 60

# Set once the client is actually connected (in on_connect) and cleared on
# disconnect - time_sync_publisher waits on this instead of firing publishes
# into a socket that isn't up yet.
mqtt_connected = threading.Event()

def offline_monitor():
    while True:
        try:
            mark_offline_devices(30)
        except Exception as error:
            print(f"[DB] Offline monitor error: {error}")
        time.sleep(5)

def time_sync_publisher():
    # The hub is the time authority for the whole local network - nodes
    # have no guaranteed internet access, but they're always on the same
    # broker as us. Retained so a device that (re)connects gets current
    # time immediately on subscribe, without waiting up to
    # TIME_SYNC_INTERVAL_SEC for the next periodic publish.
    while True:
        mqtt_connected.wait()
        try:
            payload = json.dumps({"epoch": int(time.time())})
            client.publish(TIME_SYNC_TOPIC, payload, qos=1, retain=True)
        except Exception as error:
            print(f"[MQTT] Time sync publish error: {error}")
        time.sleep(TIME_SYNC_INTERVAL_SEC)

def handle_status(message):
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
    update_device_status(hardware_id, online, rssi, uptime)
    print(f"[STATUS] id={hardware_id} online={online} rssi={rssi} uptime={uptime}")

def handle_telemetry(message):
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
	if not time_valid:
		print("[WARN] Device has not synced time yet - recording collector-side timestamp instead")

	try:
		device_id = get_or_create_device(hardware_id, device_name, device_type, firmware)
		for capability_name, reading in capabilities.items():
			save_reading(device_id, capability_name, reading.get("value"), reading.get("valid"), rssi, uptime, device_timestamp)
		print(f"[DB] Reading(s) saved(device_id={device_id})")
	except Exception as error:
		print(f"[DB] Failed to save reading: {error}")

def on_connect(client, userdata, flags, reason_code, properties):
    print(f"[MQTT] Connected: {reason_code}")
    client.subscribe(TELEMETRY_TOPIC)
    client.subscribe(STATUS_TOPIC)
    print(f"[MQTT] Subscribed to: {TELEMETRY_TOPIC}")
    print(f"[MQTT] Subscribed to: {STATUS_TOPIC}")
    mqtt_connected.set()

def on_disconnect(client, userdata, flags, reason_code, properties):
    mqtt_connected.clear()

def on_message(client, userdata, message):
    if message.topic.endswith("/status"):
        handle_status(message)
        return
    if message.topic.endswith("/telemetry"):
        handle_telemetry(message)
        return

migrate_database()
threading.Thread(target=offline_monitor,daemon=True).start()
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
client.username_pw_set(BROKER_USERNAME, BROKER_PASSWORD)
client.on_connect = on_connect
client.on_disconnect = on_disconnect
client.on_message = on_message
threading.Thread(target=time_sync_publisher,daemon=True).start()
print("[MQTT] Connecting to broker...")
client.connect(BROKER_HOST,BROKER_PORT,60)
client.loop_forever()