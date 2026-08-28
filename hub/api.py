import os
import secrets
import time
import threading
import subprocess
import re

from datetime import timedelta
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash

from config import MQTT_URI_FOR_DEVICES, MOSQUITTO_PASSWD_FILE
from database import get_connection, get_latest_readings, get_user, get_or_create_device

FIRMWARE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firmware")
SECRET_KEY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".flask_secret_key")


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

CLAIM_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # no 0/O/1/l/I - typed by hand
CLAIM_CODE_LENGTH = 6
CLAIM_WINDOW_SECONDS = 120

_pending_claims = {}
_claims_lock = threading.Lock()

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

@app.route("/api/devices/<device_name>")
@login_required
def get_device(device_name):
	connection = get_connection()
	row = connection.execute(
		_DEVICE_QUERY + " WHERE devices.device_name=?",
		(device_name,)
		).fetchone()
	connection.close()
	if row is None:
		return jsonify({"error": "Device not found"}), 404

	readings = get_latest_readings([row["id"]]).get(row["id"], {})
	return jsonify(_serialize_device(row, readings))

@app.route("/api/devices/<device_name>/telemetry")
@login_required
def get_telemetry(device_name):
	capability = request.args.get("capability")

	connection = get_connection()
	if capability:
		rows = connection.execute(
			"""
			SELECT readings.timestamp, readings.capability, readings.value, readings.rssi, readings.uptime
			FROM readings
			JOIN devices ON devices.id = readings.device_id
			WHERE devices.device_name=? AND readings.capability=?
			ORDER BY readings.timestamp DESC LIMIT 100
			""",
			(device_name, capability)
			).fetchall()
	else:
		rows = connection.execute(
			"""
			SELECT readings.timestamp, readings.capability, readings.value, readings.rssi, readings.uptime
			FROM readings
			JOIN devices ON devices.id = readings.device_id
			WHERE devices.device_name=?
			ORDER BY readings.timestamp DESC LIMIT 100
			""",
			(device_name,)
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

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, ssl_context=("/home/farzad/iot/certs/api.crt", "/home/farzad/iot/certs/api.key"))