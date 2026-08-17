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
				ORDER BY telemetry.timestatmp DESC LIMIT 1
			) AS temperature
		FROM devices
		JOIN device_status ON devices.id = device_status.device_id
		GROUP BY devices.id
		"""
		).fetchall()

	connection.close()
	devices = []
	for row in rows:
		devices.append({
		"id": row[0],
		"name": row[1],
		"firmware": row[2],
		"first_seen": row[3],
		"last_seen": row[4],
		"online": bool(row[5]),
		"rssi": row[6],
		"uptime": row[7],
		"temperature": row[8]
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
			device_status.uptime
		FROM devices
		JOIN device_status ON devices.id = device_status.device_id
		GROUP BY devices.id
		"""
		).fetchone()
	if row is None:
		return jsonify({"error": "Device not found"}), 404
	else:
		return jsonify({
			"id": row[0],
			"name": row[1],
			"firmware": row[2],
			"first_seen": row[3],
			"last_seen": row[4],
			"online": bool(row[5]),
			"rssi": row[6],
			"uptime": row[7]
			})

@app.route("/api/devices/<device_name>/telemetry")
def get_telemetry(device_name):
	connection.get_connection()
	rows = connection.execute(
		"""
		SELECT 
			telemetry.timestatmp,
			telemetry.temperature,
			telemetry.rssi,
			telemetry.uptime
		FROM telemetry
		JOIN devices ON devices.id = telemetry.device_id
		WHERE devices.device_name=?
		ORDER BY telemetry.timestatmp DESC LIMIT 100
		""",
		(device_name,)
		).fetchall()
	telemetry = []
	for row in rows:
		telemetry.append({
			"timestamp": row[0],
			"temperature": row[1],
			"rssi": row[2],
			"uptime": row[3],
			})
	return jsonify(telemetry)

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, debug=False)