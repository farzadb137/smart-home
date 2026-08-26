import os
from flask import Flask, jsonify, request, send_from_directory
from database import get_connection, get_latest_readings

FIRMWARE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "firmware")

app = Flask(__name__, static_folder="static", static_url_path="")

@app.route("/")
def dashboard():
	return app.send_static_file("index.html")

@app.route("/api/health")
def health():
	return jsonify({"status":"ok"})

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

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, debug=False)