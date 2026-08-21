import json
import paho.mqtt.client as mqtt
import threading
import time
from config import(BROKER_HOST,BROKER_PORT,TELEMETRY_TOPIC,STATUS_TOPIC)
from database import(migrate_database,get_or_create_device,save_telemetry,update_device_status,mark_offline_devices)

def offline_monitor():
    while True:
        try:
            mark_offline_devices(30)
        except Exception as error:
            print(f"[DB] Offline monitor error: {error}")
        time.sleep(5)

def handle_status(message):
    try:
        payload = json.loads(message.payload.decode())
    except json.JSONDecodeError:
        print("[MQTT] Invalid status JSON")
        return
    device_name = (message.topic.split("/")[2])
    hardware_id = payload.get("id")
    online = payload.get("online", False)
    uptime = payload.get("uptime")
    rssi = payload.get("rssi")
    if hardware_id is None:
    	return
    update_device_status(hardware_id, device_name, None, online, rssi, uptime)
    print(f"[STATUS] {device_name} online={online} rssi={rssi} uptime={uptime}")

def handle_telemetry(message):
	try:
		payload = json.loads(message.payload.decode())
	except json.JSONDecodeError:
		print("[MQTT] Invalid telemetry JSON")
		return
	device = payload.get("device", {})
	system = payload.get("system", {})
	sensor = payload.get("sensor", {})
	hardware_id = device.get("id")
	device_name = device.get("name")
	firmware = device.get("firmware")
	rssi = system.get("rssi")
	uptime = system.get("uptime")
	temperature = sensor.get("temperature")
	valid = sensor.get("valid")
	print(f"Device:      {device_name}")
	print(f"Firmware:    {firmware}")
	print(f"Temperature: {temperature} °C")
	print(f"RSSI:        {rssi} dBm")
	print(f"Uptime:      {uptime} s")
	try:
		device_id = get_or_create_device(hardware_id, device_name, firmware)
		save_telemetry(device_id, temperature, valid, rssi, uptime)
		print(f"[DB] Telemetry saved(device_id={device_id})")
	except Exception as error:
		print(f"[DB] Failed to save telemetry: {error}")

def on_connect(client, userdata, flags, reason_code, properties):
    print(f"[MQTT] Connected: {reason_code}")
    client.subscribe(TELEMETRY_TOPIC)
    client.subscribe(STATUS_TOPIC)
    print(f"[MQTT] Subscribed to: {TELEMETRY_TOPIC}")
    print(f"[MQTT] Subscribed to: {STATUS_TOPIC}")

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
client.on_connect = on_connect
client.on_message = on_message
print("[MQTT] Connecting to broker...")
client.connect(BROKER_HOST,BROKER_PORT,60)
client.loop_forever()