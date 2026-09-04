from datetime import datetime, timezone

from .connection import get_connection

def get_or_create_device(hardware_id, device_name=None, device_type=None, firmware=None, parent_device_id=None):
	now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	row = connection.execute(
		"SELECT id FROM devices WHERE hardware_id = ?",
		(hardware_id,)
	).fetchone()
	if row is None:
		placeholder_name = device_name if device_name else f"{hardware_id:012X}"
		device_type_value = device_type if device_type else "unknown"
		cursor = connection.execute(
			"INSERT INTO devices (hardware_id, parent_device_id, device_name, device_type, firmware, first_seen) VALUES (?,?,?,?,?,?)",
			(hardware_id, parent_device_id, placeholder_name, device_type_value, firmware, now)
		)
		device_id = cursor.lastrowid
		connection.execute(
			"INSERT INTO device_status (device_id, online, rssi, uptime, last_seen) VALUES (?,?,?,?,?)",
			(device_id, 0, None, None, now)
		)
	else:
		device_id = row["id"]
		connection.execute(
			"""
			UPDATE devices SET firmware = COALESCE(?, firmware), device_name = COALESCE(?, device_name), 
			device_type = COALESCE(?, device_type), parent_device_id = COALESCE(?, parent_device_id) WHERE id = ?
			""",
			(firmware, device_name, device_type, parent_device_id, device_id)
		)
	connection.commit()
	connection.close()
	return device_id

def get_device_with_parent(hardware_id):
	connection = get_connection()
	row = connection.execute(
		"""
		SELECT
			d.id,
			d.hardware_id,
			d.parent_device_id,
			p.hardware_id AS parent_hardware_id
		FROM devices d
		LEFT JOIN devices p ON p.id = d.parent_device_id
		WHERE d.hardware_id = ?
		""",
		(hardware_id,)
	).fetchone()
	connection.close()
	return row

def update_device_status(hardware_id, online, rssi, uptime, parent_device_id=None):
	now = datetime.now(timezone.utc).isoformat()
	device_id = get_or_create_device(hardware_id, parent_device_id=parent_device_id)
	connection = get_connection()
	connection.execute(
		"UPDATE device_status SET online=?, rssi=?, uptime=?, last_seen=? WHERE device_id=?",
		(online, rssi, uptime, now, device_id)
	)
	connection.commit()
	connection.close()

def mark_offline_devices(timeout_seconds=30):
	now = datetime.now(timezone.utc)
	connection = get_connection()
	rows = connection.execute(
		"SELECT device_id, last_seen FROM device_status WHERE online=?",
		(1,)
	).fetchall()
	for device_id, last_seen in rows:
		last_seen_time = datetime.fromisoformat(last_seen)
		if (now - last_seen_time).total_seconds() > timeout_seconds:
			connection.execute(
				"UPDATE device_status SET online=? WHERE device_id=?",
				(0, device_id)
			)
	connection.commit()
	connection.close()