import json
import queue
import threading

import paho.mqtt.client as mqtt

from config import BROKER_HOST, BROKER_PORT, COMMAND_RESPONSE_TIMEOUT_SEC
from config import HUB_COMMANDER_PASSWORD, HUB_COMMANDER_USERNAME


class MqttCommander:
	def __init__(self):
		self._pending_responses = {}
		self._lock = threading.Lock()
		self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
		self._client.username_pw_set(HUB_COMMANDER_USERNAME, HUB_COMMANDER_PASSWORD)
		self._client.on_connect = self.on_connect
		self._client.on_message = self.on_message
		self._client.connect(BROKER_HOST, BROKER_PORT, 60)
		self._client.loop_start()

	def _on_connect(self, client, userdata, flags, reason_code, properties):
		print(f"[MQTT-CMD] Connected: {reason_code}")
		client.subscribe("home/devices/+/response")
		client.subscribe("home/devices/+/children/+/response")

	def _on_message(self, client, userdata, message):
		parts = message.topic.split("/")
		if len(parts) == 4:
			hardware_id_hex = parts[2]
		elif len(parts) == 6 and parts[3] == "children":
			hardware_id_hex = parts[4]
		else:
			return

		with self._lock:
			response_queue = self._pending_responses.get(hardware_id_hex)
		if response_queue is not None:
			try:
				response_queue.put_nowait(message.payload.decode())
			except queue.Full:
				pass

	def send(self, hardware_id_hex, command_payload, parent_hardware_id_hex=None):
		response_queue = queue.Queue(maxsize=1)
		with self._lock:
			self._pending_responses[hardware_id_hex] = response_queue

		try:
			if parent_hardware_id_hex:
				topic = f"home/devices/{parent_hardware_id_hex}/children/{hardware_id_hex}/command"
			else:
				topic = f"home/devices/{hardware_id_hex}/command"

			slef._client.publish(topic, json.dumps(command_payload), qos=1)
			try:
				raw = response_queue.get(timeout=COMMAND_RESPONSE_TIMEOUT_SEC)
				return True, json.loads(raw)
			except queue.Empty:
				return False, {"error": "Device did not respond in time"}
		finally:
			with self._lock:
				self._pending_responses.pop(hardware_id_hex, None)


_commander = None
_commander_lock = threading.Lock()


def get_commander():
	global _commander
	if _commander is None:
		with _commander_lock:
			if _commander is None:
				_commander = MqttCommander()
	return _commander

def send_device_command(hardware_id_hex, command_payload, parent_hardware_id_hex=None):
	return get_commander().send(hardware_id_hex, command_payload, parent_hardware_id_hex)




		