from flask import Flask, jsonify
from database import get_connection

app = Flask(__name__, static_folder="static", static_url_path="")

@app.route("/")
def dashboard():
	return app.send_static_file("index.html")

@app.route("/api/health")
def health():
	return jsonify({"status":"ok"})

@app.route("/api/devices")
def get_devices():
	connection = get_connection()
	rows = connection.execute(
		"""
		SELECT 
			devices.id,
			devices.device_name,
			devices.firmware,
			devices.first_seen,
			device_status.last_seen,
			device_status.online,
			device_status.rssi,
			device_status.uptime,
			(
				SELECT temperature FROM telemetry WHERE telemetry.device_id = devices.id
				ORDER BY telemetry.timestamp DESC LIMIT 1
			) AS temperature
		FROM devices
		JOIN device_status ON devices.id = device_status.device_id
		"""
		).fetchall()

	connection.close()
	devices = []
	for row in rows:
		devices.append({
		"id": row["id"],
		"name": row["device_name"],
		"firmware": row["firmware"],
		"first_seen": row["first_seen"],
		"last_seen": row["last_seen"],
		"online": bool(row["online"]),
		"rssi": row["rssi"],
		"uptime": row["uptime"],
		"temperature": row["temperature"]
		})
	return jsonify(devices)

@app.route("/api/devices/<device_name>")
def get_device(device_name):
	connection = get_connection()
	row = connection.execute(
		"""
		SELECT 
			devices.id,
			devices.device_name,
			devices.firmware,
			devices.first_seen,
			device_status.last_seen,
			device_status.online,
			device_status.rssi,
			device_status.uptime,
			(
                SELECT temperature
                FROM telemetry
                WHERE telemetry.device_id = devices.id
                ORDER BY telemetry.timestamp DESC
                LIMIT 1
            ) AS temperature
		FROM devices
		JOIN device_status ON devices.id = device_status.device_id
		WHERE devices.device_name=?
		""",
		(device_name,)
		).fetchone()
	connection.close()
	if row is None:
		return jsonify({"error": "Device not found"}), 404
	return jsonify({
		"id": row["id"],
		"name": row["device_name"],
		"firmware": row["firmware"],
		"first_seen": row["first_seen"],
		"last_seen": row["last_seen"],
		"online": bool(row["online"]),
		"rssi": row["rssi"],
		"uptime": row["uptime"],
		"temperature": row["temperature"]
		})

@app.route("/api/devices/<device_name>/telemetry")
def get_telemetry(device_name):
	connection = get_connection()
	rows = connection.execute(
		"""
		SELECT 
			telemetry.timestamp,
			telemetry.temperature,
			telemetry.rssi,
			telemetry.uptime
		FROM telemetry
		JOIN devices ON devices.id = telemetry.device_id
		WHERE devices.device_name=?
		ORDER BY telemetry.timestamp DESC LIMIT 100
		""",
		(device_name,)
		).fetchall()
	connection.close()
	telemetry = []
	for row in rows:
		telemetry.append({
			"timestamp": row["timestamp"],
			"temperature": row["temperature"],
			"rssi": row["rssi"],
			"uptime": row["uptime"],
			})
	return jsonify(telemetry)

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, debug=False)