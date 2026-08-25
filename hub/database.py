import sqlite3
from config import DATABASE_PATH, RAW_TELEMETRY_RETENTION_DAYS
from datetime import datetime, timezone, timedelta

CURRENT_SCHEMA_VERSION = 1

def get_connection():
	connection = sqlite3.connect(DATABASE_PATH)
	connection.row_factory = sqlite3.Row
	connection.execute("PRAGMA foreign_keys = ON")
	connection.execute("PRAGMA journal_mode = WAL")
	return connection

def init_database():
	connection = get_connection()
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS devices(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hardware_id INTEGER NOT NULL UNIQUE,
			device_name TEXT NOT NULL,
			device_type TEXT NOT NULL DEFAULT 'unknown',
			manufacturer TEXT,
			model TEXT,
			hardware TEXT,
			firmware TEXT,
			first_seen TEXT NOT NULL
			)
		"""
		)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS device_status(
			device_id INTEGER PRIMARY KEY,
			online INTEGER NOT NULL DEFAULT 0,
			rssi INTEGER,
			uptime INTEGER,
			last_seen TEXT NOT NULL,
			FOREIGN KEY (device_id) REFERENCES devices(id)
			)
		"""
		)
	# capability is the generalization point - "temperature", "switch",
	# "contact", etc. A new device type means a new capability string
	# shows up here, not a new column or a new table.
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS readings(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			device_id INTEGER NOT NULL,
			capability TEXT NOT NULL,
			timestamp TEXT NOT NULL,
			value REAL,
			valid INTEGER,
			rssi INTEGER,
			uptime INTEGER,
			FOREIGN KEY (device_id) REFERENCES devices(id)
			)
		"""
		)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_readings_device_capability_timestamp ON readings (device_id, capability, timestamp)"
		)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS readings_hourly(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			device_id INTEGER NOT NULL,
			capability TEXT NOT NULL,
			hour_start TEXT NOT NULL,
			sample_count INTEGER NOT NULL,
			value_avg REAL,
			value_min REAL,
			value_max REAL,
			rssi_avg REAL,
			FOREIGN KEY (device_id) REFERENCES devices(id),
			UNIQUE(device_id, capability, hour_start)
			)
		"""
		)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_readings_hourly_device_capability_hour ON readings_hourly (device_id, capability, hour_start)"
		)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS schema_version(
			version INTEGER NOT NULL
			)
		"""
		)
	connection.commit()
	connection.close()

def migrate_database():
	init_database()
	connection = get_connection()
	row = connection.execute(
		"SELECT version FROM schema_version"
		).fetchone()
	if row is None:
		connection.execute(
			"INSERT INTO schema_version (version) VALUES (?)",
			(CURRENT_SCHEMA_VERSION,)
			)
	connection.commit()
	connection.close()

def get_or_create_device(hardware_id, device_name, device_type, firmware):
	now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	row = connection.execute(
		"SELECT id FROM devices WHERE hardware_id = ?",
		(hardware_id,)
		).fetchone()
	if row is None:
		device_type_value = device_type if device_type else "unknown"
		cursor = connection.execute(
			"INSERT INTO devices (hardware_id, device_name, device_type, firmware, first_seen) VALUES (?,?,?,?,?)",
			(hardware_id, device_name, device_type_value, firmware, now)
			)
		device_id = cursor.lastrowid
		connection.execute(
			"INSERT INTO device_status (device_id, online, rssi, uptime, last_seen) VALUES (?,?,?,?,?)",
			(device_id, 0, None, None, now)
			)
	else:
		device_id = row["id"]
		connection.execute(
			"UPDATE devices SET firmware = COALESCE(?, firmware), device_name=?, device_type = COALESCE(?, device_type) WHERE id = ?",
			(firmware, device_name, device_type, device_id)
			)
	connection.commit()
	connection.close()
	return device_id

def update_device_status(hardware_id, device_name, firmware, online, rssi, uptime):
	now = datetime.now(timezone.utc).isoformat()
	device_id = get_or_create_device(hardware_id, device_name, None, firmware)
	connection = get_connection()
	connection.execute(
		"UPDATE device_status SET online=?, rssi=?, uptime=?, last_seen=? WHERE device_id=?",
		(online, rssi, uptime, now, device_id)
		)
	connection.commit()
	connection.close()

def save_reading(device_id, capability, value, valid, rssi, uptime, device_timestamp=None):
	if device_timestamp:
		now = datetime.fromtimestamp(device_timestamp, tz=timezone.utc).isoformat()
	else:
		now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	connection.execute(
		"INSERT INTO readings (device_id, capability, timestamp, value, valid, rssi, uptime) VALUES (?,?,?,?,?,?,?)",
		(device_id, capability, now, value, valid, rssi, uptime)
		)
	connection.commit()
	connection.close()

def get_latest_readings(device_ids):
	if not device_ids:
		return {}
	connection = get_connection()
	placeholders = ",".join("?" for _ in device_ids)
	rows = connection.execute(
		f"""
		SELECT r.device_id, r.capability, r.value, r.timestamp
		FROM readings r
		INNER JOIN (
			SELECT device_id, capability, MAX(timestamp) AS max_timestamp
			FROM readings
			WHERE device_id IN ({placeholders})
			GROUP BY device_id, capability
			) latest
			ON r.device_id = latest.device_id
			AND r.capability = latest.capability
			AND r.timestamp = latest.max_timestamp
		""",
		device_ids
		).fetchall()
	connection.close()
	result = {}
	for row in rows:
		result.setdefault(row["device_id"], {})[row["capability"]] = {
			"value": row["value"],
			"timestamp": row["timestamp"]
			}
	return result

def rollup_and_prune(retention_days=RAW_TELEMETRY_RETENTION_DAYS):
	cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
	connection = get_connection()
	connection.execute(
		"""
		INSERT INTO readings_hourly
			(device_id, capability, hour_start, sample_count, value_avg, value_min, value_max, rssi_avg)
		SELECT
			device_id, capability,
			strftime('%Y-%m-%dT%H:00:00', timestamp) AS hour_start,
			COUNT(*), AVG(value), MIN(value), MAX(value), AVG(rssi)
		FROM readings
		WHERE timestamp < ? AND valid = 1
		GROUP BY device_id, capability, hour_start
		ON CONFLICT(device_id, capability, hour_start) DO NOTHING
		""",
		(cutoff,)
		)
	cursor = connection.execute("DELETE FROM readings WHERE timestamp < ?", (cutoff,))
	deleted = cursor.rowcount
	connection.commit()
	connection.close()
	return deleted

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