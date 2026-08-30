import os
import secrets
import time
import threading
import queue
import subprocess
import re
import paho.mqtt.client as mqtt
import json
import hashlib
import struct
from werkzeug.utils import secure_filename

from datetime import timedelta
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash

from config import (
	BROKER_HOST, BROKER_PORT,
	HUB_COMMANDER_USERNAME, HUB_COMMANDER_PASSWORD,
	COMMAND_RESPONSE_TIMEOUT_SEC,
	FIRMWARE_BASE_URL
)
from database import (
	get_connection, get_latest_readings,
	get_user, get_or_create_device, get_device_history
)

FIRMWARE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firmware")
SECRET_KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".flask_secret_key")

VALID_HISTORY_RANGES = {"24h", "7d", "30d"}

def _load_or_create_secret_key():
	if os.path.exists(SECRET_KEY_PATH):
		with open(SECRET_KEY_PATH, "r") as f:
			return f.read().strip()
	key = secrets.token_hex(32)
	with open(SECRET_KEY_PATH, "w") as f:
		f.write(key)
	os.chmod(SECRET_KEY_PATH, 0o600)
	return key

app = Flask(__name__, static_folder="static", static_url_path="")
app.secret_key = _load_or_create_secret_key()
app.config.update(
	SESSION_COOKIE_HTTPONLY=True,
	SESSION_COOKIE_SECURE=True,
	SESSION_COOKIE_SAMESITE="Lax",
	PERMANENT_SESSION_LIFETIME=timedelta(days=30)
	)
app.config['MAX_CONTENT_LENGTH'] = 4 * 1024 * 1024  # generous ceiling for an ESP32 app image

APP_DESC_MAGIC = 0xABCD5432
APP_DESC_OFFSET = 0x20  # sizeof(esp_image_header_t) + sizeof(esp_image_segment_header_t)

def parse_firmware_description(binary_data):
	# Reads the fixed-offset esp_app_desc_t header ESP-IDF embeds in every
	# app image, instead of trusting a hand-typed version string - removes
	# the whole class of "uploaded v2, form still said v1" mistakes.
	if len(binary_data) < APP_DESC_OFFSET + 0x50:
		return None

	magic = struct.unpack_from("<I", binary_data, APP_DESC_OFFSET)[0]
	if magic != APP_DESC_MAGIC:
		return None

	version_bytes = binary_data[APP_DESC_OFFSET + 0x10 : APP_DESC_OFFSET + 0x10 + 32]
	project_bytes = binary_data[APP_DESC_OFFSET + 0x30 : APP_DESC_OFFSET + 0x30 + 32]

	version = version_bytes.split(b"\x00", 1)[0].decode("utf-8", errors="replace")
	project_name = project_bytes.split(b"\x00", 1)[0].decode("utf-8", errors="replace")

	return {"version": version, "project_name": project_name}

CLAIM_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # no 0/O/1/l/I - typed by hand
CLAIM_CODE_LENGTH = 6
CLAIM_WINDOW_SECONDS = 120

# A second, independent MQTT client (separate from the collector's) using
# the hub_commander account - scoped by ACL to command/response topics
# only, matching the boundary already documented in /etc/mosquitto/acl.
_pending_responses = {}
_pending_lock = threading.Lock()

def _on_commander_connect(client, userdata, flags, reason_code, properties):
	print(f"[MQTT-CMD] Connected: {reason_code}")
	client.subscribe("home/devices/+/response")

def _on_commander_message(client, userdata, message):
	parts = message.topic.split("/")
	if len(parts) != 4:
		return
	hardware_id_hex = parts[2]
	with _pending_lock:
		response_queue = _pending_responses.get(hardware_id_hex)
	if response_queue is not None:
		try:
			response_queue.put_nowait(message.payload.decode())
		except queue.Full:
			pass

_commander = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
_commander.username_pw_set(HUB_COMMANDER_USERNAME, HUB_COMMANDER_PASSWORD)
_commander.on_connect = _on_commander_connect
_commander.on_message = _on_commander_message
_commander.connect(BROKER_HOST, BROKER_PORT, 60)
_commander.loop_start()

def send_device_command(hardware_id_hex, command_payload):
	# NOTE: correlates a response to a request by device ID only - there's
	# no per-request ID in the command protocol today. Fine for a single-
	# operator dashboard; would need a real request ID if ever called
	# concurrently for the same device (see design notes).
	response_queue = queue.Queue(maxsize=1)
	with _pending_lock:
		_pending_responses[hardware_id_hex] = response_queue

	try:
		topic = f"home/devices/{hardware_id_hex}/command"
		_commander.publish(topic, json.dumps(command_payload), qos=1)

		try:
			raw = response_queue.get(timeout=COMMAND_RESPONSE_TIMEOUT_SEC)
			return True, json.loads(raw)
		except queue.Empty:
			return False, {"error": "Device did not respond in time"}
	finally:
		with _pending_lock:
			_pending_responses.pop(hardware_id_hex, None)

def _generate_claim_code():
	return "".join(secrets.choice(CLAIM_CODE_CHARSET) for _ in range(CLAIM_CODE_LENGTH))

def _cleanup_expired_claims():
	now = time.time()
	expired = [code for code, claim in _pending_claims.items() if claim["expires_at"] < now]
	for code in expired:
		del _pending_claims[code]

def _provision_mqtt_credentials(username):
	# Re-implements add_device.sh in Python so it can run from an API
	# request instead of requiring SSH + manual invocation. Same tool,
	# same file, same reload - just triggered differently.
	password = secrets.token_urlsafe(18)

	if os.path.exists(MOSQUITTO_PASSWD_FILE):
		cmd = ["sudo", "mosquitto_passwd", "-b", MOSQUITTO_PASSWD_FILE, username, password]
	else:
		cmd = ["sudo", "mosquitto_passwd", "-c", "-b", MOSQUITTO_PASSWD_FILE, username, password]

	subprocess.run(cmd, check=True, capture_output=True, text=True)
	subprocess.run(["sudo", "systemctl", "reload", "mosquitto"], check=True, capture_output=True, text=True)

	return password

def login_required(view):
	@wraps(view)
	def wrapped(*args, **kwargs):
		if not session.get("user_id"):
			return jsonify({"error": "Authentication required"}), 401
		return view(*args, **kwargs)
	return wrapped

@app.route("/")
def dashboard():
	return app.send_static_file("index.html")

@app.route("/login")
def login_page():
	return app.send_static_file("login.html")

@app.route("/api/health")
def health():
	return jsonify({"status":"ok"})

@app.route("/api/login", methods=["POST"])
def login():
	data = request.get_json(silent=True) or request.form
	username = (data.get("username") or "").strip()
	password = data.get("password") or ""

	user = get_user(username)
	if (user is None) or (not check_password_hash(user["password_hash"], password)):
		return jsonify({"error": "Invalid username or password"}), 401

	session.clear()
	session.permanent = True
	session["user_id"] = user["id"]
	session["username"] = user["username"]

	return jsonify({"success": True})

@app.route("/api/logout", methods=["POST"])
def logout():
	session.clear()
	return jsonify({"success": True})

@app.route("/api/session")
def session_status():
	if session.get("user_id"):
		return jsonify({"authenticated": True, "username": session.get("username")})
	return jsonify({"authenticated": False})

def _serialize_device(row, readings):
	return {
		"id": row["id"],
		"hardware_id": row["hardware_id"],
		"hardware_id_hex": f"{row['hardware_id']:012X}",
		"name": row["device_name"],
		"type": row["device_type"],
		"manufacturer": row["manufacturer"],
		"model": row["model"],
		"hardware": row["hardware"],
		"firmware": row["firmware"],
		"first_seen": row["first_seen"],
		"last_seen": row["last_seen"],
		"online": bool(row["online"]),
		"rssi": row["rssi"],
		"uptime": row["uptime"],
		"readings": readings
		}

_DEVICE_QUERY = """
	SELECT 
		devices.id, devices.hardware_id, devices.device_name, devices.device_type,
		devices.manufacturer, devices.model, devices.hardware, devices.firmware, devices.first_seen,
		device_status.last_seen, device_status.online, device_status.rssi, device_status.uptime
	FROM devices
	JOIN device_status ON devices.id = device_status.device_id
	"""

@app.route("/api/devices")
@login_required
def get_devices():
	connection = get_connection()
	rows = connection.execute(_DEVICE_QUERY).fetchall()
	connection.close()

	readings_by_device = get_latest_readings([row["id"] for row in rows])

	return jsonify([
		_serialize_device(row, readings_by_device.get(row["id"], {}))
		for row in rows
		])

@app.route("/api/devices/<hardware_id_hex>")
@login_required
def get_device(hardware_id_hex):
	if not re.match(r"^[0-9A-Fa-f]{12}$", hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	connection = get_connection()
	row = connection.execute(
		_DEVICE_QUERY + " WHERE devices.hardware_id=?",
		(int(hardware_id_hex, 16),)
		).fetchone()
	connection.close()

	if row is None:
		return jsonify({"error": "Device not found"}), 404

	readings = get_latest_readings([row["id"]]).get(row["id"], {})
	return jsonify(_serialize_device(row, readings))

@app.route("/api/devices/<hardware_id_hex>/telemetry")
@login_required
def get_telemetry(hardware_id_hex):
	if not re.match(r"^[0-9A-Fa-f]{12}$", hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	capability = request.args.get("capability")
	hardware_id = int(hardware_id_hex, 16)

	connection = get_connection()
	if capability:
		rows = connection.execute(
			"""
			SELECT readings.timestamp, readings.capability, readings.value, readings.rssi, readings.uptime
			FROM readings
			JOIN devices ON devices.id = readings.device_id
			WHERE devices.hardware_id=? AND readings.capability=?
			ORDER BY readings.timestamp DESC LIMIT 100
			""",
			(hardware_id, capability)
			).fetchall()
	else:
		rows = connection.execute(
			"""
			SELECT readings.timestamp, readings.capability, readings.value, readings.rssi, readings.uptime
			FROM readings
			JOIN devices ON devices.id = readings.device_id
			WHERE devices.hardware_id=?
			ORDER BY readings.timestamp DESC LIMIT 100
			""",
			(hardware_id,)
			).fetchall()
	connection.close()

	return jsonify([
		{
			"timestamp": row["timestamp"],
			"capability": row["capability"],
			"value": row["value"],
			"rssi": row["rssi"],
			"uptime": row["uptime"]
			}
		for row in rows
		])

@app.route("/api/devices/<hardware_id_hex>/command", methods=["POST"])
@login_required
def send_command(hardware_id_hex):
	if not re.match(r"^[0-9A-Fa-f]{12}$", hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	hardware_id_hex = hardware_id_hex.upper()

	connection = get_connection()
	row = connection.execute(
		"SELECT id FROM devices WHERE hardware_id=?",
		(int(hardware_id_hex, 16),)
		).fetchone()
	connection.close()

	if row is None:
		return jsonify({"error": "Device not found"}), 404

	payload = request.get_json(silent=True) or {}
	command = payload.get("command")
	if not command:
		return jsonify({"error": "Missing 'command'"}), 400

	command_payload = {"command": command}
	if "data" in payload:
		command_payload["data"] = payload["data"]

	ok, response = send_device_command(hardware_id_hex, command_payload)

	if not ok:
		return jsonify({"success": False, "error": response.get("error", "Command failed")}), 504

	return jsonify(response)

@app.route("/api/devices/<hardware_id_hex>/rename", methods=["POST"])
@login_required
def rename_device(hardware_id_hex):
	if not re.match(r"^[0-9A-Fa-f]{12}$", hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	payload = request.get_json(silent=True) or {}
	new_name = (payload.get("name") or "").strip()

	if not new_name:
		return jsonify({"success": False, "error": "Name cannot be empty"}), 400
	if len(new_name) > 31:  # firmware's device_name field is char[32] (31 chars + null)
		return jsonify({"success": False, "error": "Name must be 31 characters or fewer"}), 400

	command_payload = {"command": "set_config", "data": {"device_name": new_name}}
	ok, response = send_device_command(hardware_id_hex.upper(), command_payload)

	if not ok:
		return jsonify({"success": False, "error": response.get("error", "Rename failed")}), 504

	return jsonify(response)

@app.route("/api/devices/<hardware_id_hex>/firmware", methods=["POST"])
@login_required
def upload_firmware(hardware_id_hex):
	if not re.match(r"^[0-9A-Fa-f]{12}$", hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	if "firmware" not in request.files:
		return jsonify({"success": False, "error": "No firmware file provided"}), 400

	binary_data = request.files["firmware"].read()

	description = parse_firmware_description(binary_data)
	if description is None:
		return jsonify({"success": False, "error": "Not a valid ESP-IDF firmware image (app description header not found)"}), 400

	sha256_hex = hashlib.sha256(binary_data).hexdigest()

	filename = secure_filename(f"{description['project_name']}_{description['version']}.bin")
	os.makedirs(FIRMWARE_DIR, exist_ok=True)
	with open(os.path.join(FIRMWARE_DIR, filename), "wb") as f:
		f.write(binary_data)

	url = f"{FIRMWARE_BASE_URL}/firmware/{filename}"

	command_payload = {
		"command": "ota_update",
		"data": {"url": url, "version": description["version"], "sha256": sha256_hex}
		}

	ok, response = send_device_command(hardware_id_hex.upper(), command_payload)

	if not ok:
		return jsonify({"success": False, "error": response.get("error", "Device did not acknowledge the update")}), 504

	response.setdefault("data", {})
	response["data"]["version"] = description["version"]
	response["data"]["project_name"] = description["project_name"]

	return jsonify(response)

@app.route("/firmware/<path:filename>")
def get_firmware(filename):
	return send_from_directory(FIRMWARE_DIR, filename, mimetype="application/octet-stream")

@app.route("/api/provision/start", methods=["POST"])
@login_required
def provision_start():
	with _claims_lock:
		_cleanup_expired_claims()
		code = _generate_claim_code()
		while code in _pending_claims:
			code = _generate_claim_code()
		_pending_claims[code] = {"expires_at": time.time() + CLAIM_WINDOW_SECONDS}

	return jsonify({"success": True, "data": {"code": code, "expires_in": CLAIM_WINDOW_SECONDS}})

@app.route("/api/provision/claim", methods=["POST"])
def provision_claim():
	# Deliberately NOT login_required - the device has no session or
	# browser. It authenticates this one request with the short-lived
	# claim code instead, the same trust model /firmware already uses
	# (HTTPS + a secret proven over that channel, not a login).
	payload = request.get_json(silent=True) or {}
	claim_code = (payload.get("claim_code") or "").strip().upper()
	hardware_id = (payload.get("hardware_id") or "").strip().upper()
	device_type = payload.get("device_type")

	if not re.match(r"^[0-9A-F]{12}$", hardware_id):
		return jsonify({"success": False, "error": "Invalid hardware_id"}), 400

	with _claims_lock:
		_cleanup_expired_claims()
		claim = _pending_claims.pop(claim_code, None)  # pop = single-use, can't be replayed

	if claim is None:
		return jsonify({"success": False, "error": "Invalid or expired claim code"}), 400

	try:
		password = _provision_mqtt_credentials(hardware_id)
	except subprocess.CalledProcessError as error:
		print(f"[PROVISION] Credential generation failed: {error.stderr}")
		return jsonify({"success": False, "error": "Failed to generate device credentials"}), 500

	get_or_create_device(int(hardware_id, 16), None, device_type, None)

	print(f"[PROVISION] Claimed device {hardware_id}")

	return jsonify({
		"success": True,
		"data": {
			"mqtt_uri": MQTT_URI_FOR_DEVICES,
			"mqtt_username": hardware_id,
			"mqtt_password": password
		}
	})

@app.route("/add-device")
def add_device_page():
	return app.send_static_file("add-device.html")

@app.route("/api/devices/<hardware_id_hex>/history")
@login_required
def get_history(hardware_id_hex):
	if not re.match(r"^[0-9A-Fa-f]{12}$", hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	capability = request.args.get("capability")
	range_key = request.args.get("range", "24h")

	if not capability:
		return jsonify({"error": "Missing 'capability'"}), 400
	if range_key not in VALID_HISTORY_RANGES:
		return jsonify({"error": f"Invalid range, must be one of {sorted(VALID_HISTORY_RANGES)}"}), 400

	hardware_id = int(hardware_id_hex, 16)
	history = get_device_history(hardware_id, capability, range_key)

	if history is None:
		return jsonify({"error": "Failed to fetch history"}), 500

	return jsonify(history)

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, ssl_context=("/home/farzad/iot/certs/api.crt", "/home/farzad/iot/certs/api.key"))