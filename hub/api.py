import os
import secrets
from datetime import timedelta
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash

from database import get_connection, get_latest_readings, get_user

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
	# Deliberately NOT login_required - devices have no session, no browser.
	# Protected instead by HTTPS + the SHA-256 supplied over the already-
	# authenticated MQTT channel. See roadmap notes for the reasoning.
	return send_from_directory(FIRMWARE_DIR, filename, mimetype="application/octet-stream")

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, ssl_context=("/home/farzad/iot/certs/api.crt", "/home/farzad/iot/certs/api.key"))