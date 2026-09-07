import re

from flask import Blueprint, jsonify, request, session

from database import (
    get_connection,
    get_device_history,
    get_device_with_parent,
    get_latest_readings,
    add_activity,
)
from hub_app.auth import login_required
from hub_app.mqtt_commander import send_device_command
from hub_app.config import HARDWARE_ID_PATTERN, VALID_HISTORY_RANGES

bp = Blueprint("devices", __name__)

_DEVICE_QUERY = """
	SELECT 
		devices.id,
		devices.hardware_id,
		devices.device_name,
		devices.device_type,
		devices.manufacturer,
		devices.model,
		devices.hardware,
		devices.firmware,
		devices.first_seen,
		devices.parent_device_id,
		parent.hardware_id AS parent_hardware_id,
		parent.device_name AS parent_device_name,
		devices.room_id,
		room.name AS room_name,
		device_status.last_seen,
		device_status.online,
		device_status.rssi,
		device_status.uptime
	FROM devices
	JOIN device_status ON devices.id = device_status.device_id
	LEFT JOIN devices AS parent ON parent.id = devices.parent_device_id
	LEFT JOIN rooms AS room ON room.id = devices.room_id
	"""

def _valid_hardware_id(hardware_id_hex):
    return re.match(HARDWARE_ID_PATTERN, hardware_id_hex) is not None

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
		"parent_hardware_id_hex": (
			f"{row['parent_hardware_id']:012X}"
			if row["parent_hardware_id"] is not None
			else None
		),
		"parent_name": row["parent_device_name"],
		"room_id": row["room_id"],
		"room_name": row["room_name"]
		}

def _resolve_parent_hardware_id_hex(hardware_id_hex):
	device = get_device_with_parent(int(hardware_id_hex, 16))
	if device is None:
		return False, None
	if device["parent_hardware_id"] is None:
		return True, None
	return True, f"{device['parent_hardware_id']:012X}"

@bp.route("/api/devices")
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

@bp.route("/api/devices/<hardware_id_hex>")
@login_required
def get_device(hardware_id_hex):
	if not _valid_hardware_id(hardware_id_hex):
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

@bp.route("/api/devices/<hardware_id_hex>/telemetry")
@login_required
def get_telemetry(hardware_id_hex):
	if not _valid_hardware_id(hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	capability = request.args.get("capability")
	hardware_id = int(hardware_id_hex, 16)
	connection = get_connection()

	if capability:
		rows = connection.execute(
			"""
			SELECT
				readings.timestamp,
				readings.capability,
				readings.value,
				readings.rssi,
				readings.uptime
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
			SELECT
				readings.timestamp,
				readings.capability,
				readings.value,
				readings.rssi,
				readings.uptime
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

@bp.route("/api/devices/<hardware_id_hex>/command", methods=["POST"])
@login_required
def send_command(hardware_id_hex):
	if not _valid_hardware_id(hardware_id_hex):
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

	device = get_device_with_parent(int(hardware_id_hex, 16))
	add_activity(
		"command",
		f"Command sent to {device['device_name'] if device else hardware_id_hex}",
		user_id=session.get("user_id"),
		device_id=device["id"] if device else None,
		metadata={"command": command, "data": payload.get("data")}
	)
	return jsonify(response)

@bp.route("/api/devices/<hardware_id_hex>/rename", methods=["POST"])
@login_required
def rename_device(hardware_id_hex):
	if not _valid_hardware_id(hardware_id_hex):
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

	device = get_device_with_parent(int(hardware_id_hex, 16))
	add_activity(
		"device.rename",
		f"Renamed device to {new_name}",
		user_id=session.get("user_id"),
		device_id=device["id"] if device else None,
		metadata={"name": new_name}
	)
	return jsonify(response)

@bp.route("/api/devices/<hardware_id_hex>/history")
@login_required
def get_history(hardware_id_hex):
	if not _valid_hardware_id(hardware_id_hex):
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

