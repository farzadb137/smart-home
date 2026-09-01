import hashlib
import json
import os
import queue
import re
import secrets
import struct
import subprocess
import threading
import time
from datetime import timedelta
from functools import wraps

import paho.mqtt.client as mqtt
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash
from werkzeug.utils import secure_filename

from config import (
	BROKER_HOST,
	BROKER_PORT,
	HUB_COMMANDER_USERNAME,
	HUB_COMMANDER_PASSWORD,
	COMMAND_RESPONSE_TIMEOUT_SEC,
	FIRMWARE_BASE_URL
)
from database import (
	get_connection,
	get_latest_readings,
	get_user,
	get_user_by_id,
	get_or_create_device,
	get_device_history,
	get_device_with_parent
)

# ============================================================
# Configuration / Constants
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FIRMWARE_DIR = os.path.join(BASE_DIR, "firmware")
SECRET_KEY_PATH = os.path.join(BASE_DIR, ".flask_secret_key")

VALID_HISTORY_RANGES = {"24h", "7d", "30d", "90d", "1y"}

HARDWARE_ID_PATTERN = re.compile(r"^(?:[0-9A-Fa-f]{12}|[0-9A-Fa-f]{16})$")

APP_DESC_MAGIC = 0xABCD5432
APP_DESC_OFFSET = 0x20

CLAIM_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CLAIM_CODE_LENGTH = 6
CLAIM_WINDOW_SECONDS = 120

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

def parse_firmware_description(binary_data):
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

_pending_responses = {}
_pending_lock = threading.Lock()

def _on_commander_connect(client, userdata, flags, reason_code, properties):
	print(f"[MQTT-CMD] Connected: {reason_code}")
	client.subscribe("home/devices/+/response")
	client.subscribe("home/devices/+/children/+/response")

def _on_commander_message(client, userdata, message):
	parts = message.topic.split("/")
	if len(parts) == 4:
		hardware_id_hex = parts[2]
	elif len(parts) == 6 and parts[3] == "children":
		hardware_id_hex = parts[4]
	else:
		return
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

def send_device_command(hardware_id_hex, command_payload, parent_hardware_id_hex=None):
	response_queue = queue.Queue(maxsize=1)
	with _pending_lock:
		_pending_responses[hardware_id_hex] = response_queue
	try:
		if parent_hardware_id_hex:
			topic = f"home/devices/{parent_hardware_id_hex}/children/{hardware_id_hex}/command"
		else:
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

def _resolve_parent_hardware_id_hex(hardware_id_hex):
	device = get_device_with_parent(int(hardware_id_hex, 16))
	if device is None:
		return False, None
	if device["parent_hardware_id"] is None:
		return True, None
	return True, f"{device['parent_hardware_id']:012X}"

def _generate_claim_code():
	return "".join(secrets.choice(CLAIM_CODE_CHARSET) for _ in range(CLAIM_CODE_LENGTH))

def _cleanup_expired_claims():
	now = time.time()
	expired = [code for code, claim in _pending_claims.items() if claim["expires_at"] < now]
	for code in expired:
		del _pending_claims[code]

def _provision_mqtt_credentials(username):
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
		user_id = session.get("user_id")
		if not user_id:
			return jsonify({"error": "Authentication required"}), 401
		user = get_user_by_id(user_id)
		if user is None:
			session.clear()
			return jsonify({"error": "Authentication required"}), 401
		session["username"] = user["username"]
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
	user_id = session.get("user_id")
	if not user_id:
		return jsonify({"authenticated": False})
	user = get_user_by_id(user_id)
	if user is None:
		session.clear()
		return jsonify({"authenticated": False})
	session["username"] = user["username"]
	return jsonify({"authenticated": True, "username": user["username"]})

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
		"readings": readings,
		"parent_hardware_id_hex": f"{row['parent_hardware_id']:012X}" if row["parent_hardware_id"] is not None else None,
		"parent_name": row["parent_device_name"]
		}

_DEVICE_QUERY = """
	SELECT 
		devices.id, devices.hardware_id, devices.device_name, devices.device_type,
		devices.manufacturer, devices.model, devices.hardware, devices.firmware, devices.first_seen,
		devices.parent_device_id,
		parent.hardware_id AS parent_hardware_id,
		parent.device_name AS parent_device_name,
		device_status.last_seen, device_status.online, device_status.rssi, device_status.uptime
	FROM devices
	JOIN device_status ON devices.id = device_status.device_id
	LEFT JOIN devices AS parent ON parent.id = devices.parent_device_id
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
	if not re.match(HARDWARE_ID_PATTERN, hardware_id_hex):
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
	if not re.match(HARDWARE_ID_PATTERN, hardware_id_hex):
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
	if not HARDWARE_ID_PATTERN.match(hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	hardware_id_hex = hardware_id_hex.upper()

	found, parent_hardware_id_hex = _resolve_parent_hardware_id_hex(hardware_id_hex)
	if not found:
		return jsonify({"error": "Device not found"}), 404

	payload = request.get_json(silent=True) or {}
	command = payload.get("command")
	if not command:
		return jsonify({"error": "Missing 'command'"}), 400

	command_payload = {"command": command}
	if "data" in payload:
		command_payload["data"] = payload["data"]

	ok, response = send_device_command(hardware_id_hex, command_payload, parent_hardware_id_hex)

	if not ok:
		return jsonify({"success": False, "error": response.get("error", "Command failed")}), 504

	return jsonify(response)

@app.route("/api/devices/<hardware_id_hex>/rename", methods=["POST"])
@login_required
def rename_device(hardware_id_hex):
	if not HARDWARE_ID_PATTERN.match(hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	hardware_id_hex = hardware_id_hex.upper()

	found, parent_hardware_id_hex = _resolve_parent_hardware_id_hex(hardware_id_hex)
	if not found:
		return jsonify({"success": False, "error": "Device not found"}), 404

	payload = request.get_json(silent=True) or {}
	new_name = (payload.get("name") or "").strip()

	if not new_name:
		return jsonify({"success": False, "error": "Name cannot be empty"}), 400
	if len(new_name) > 31:  # firmware's device_name field is char[32] (31 chars + null)
		return jsonify({"success": False, "error": "Name must be 31 characters or fewer"}), 400

	command_payload = {"command": "set_config", "data": {"device_name": new_name}}
	ok, response = send_device_command(hardware_id_hex, command_payload, parent_hardware_id_hex)

	if not ok:
		return jsonify({"success": False, "error": response.get("error", "Rename failed")}), 504

	return jsonify(response)

@app.route("/api/devices/<hardware_id_hex>/firmware", methods=["POST"])
@login_required
def upload_firmware(hardware_id_hex):
	if not HARDWARE_ID_PATTERN.match(hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	hardware_id_hex = hardware_id_hex.upper()

	found, parent_hardware_id_hex = _resolve_parent_hardware_id_hex(hardware_id_hex)
	if not found:
		return jsonify({"success": False, "error": "Device not found"}), 404

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

	ok, response = send_device_command(hardware_id_hex, command_payload, parent_hardware_id_hex)

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
	if not HARDWARE_ID_PATTERN.match(hardware_id_hex):
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