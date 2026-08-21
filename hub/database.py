import sqlite3
from config import DATABASE_PATH
from datetime import datetime, timezone

CURRENT_SCHEMA_VERSION = 1

def get_connection():
	connection = sqlite3.connect(DATABASE_PATH)
	connection.row_factory = sqlite3.Row
	connection.execute("PRAGMA foreign_keys = ON")
	connection.execute("PRAGMA journal_mode = WAL")
	return connection

def init_database_v1():
	connection = get_connection()
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS devices(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hardware_id INTEGER NOT NULL UNIQUE,
			device_name TEXT NOT NULL,
			device_type TEXT NOT NULL DEFAULT 'temperature_sensor',
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
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS telemetry(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			device_id INTEGER NOT NULL,
			timestamp TEXT NOT NULL,
			temperature REAL,
			valid INTEGER,
			rssi INTEGER,
			uptime INTEGER,
			FOREIGN KEY (device_id) REFERENCES devices(id)
			)
		"""
		)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS schema_version(
			version INTEGER NOT NULL
			)
		"""
		)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_telemetry_device_timestamp ON telemetry (device_id, timestamp)"
		)
	connection.commit()
	connection.close()

def migrate_database():
	init_database_v1()
	connection = get_connection()
	row = connection.execute(
		"SELECT version FROM schema_version"
		).fetchone()
	if row is None:
		connection.execute(
			"INSERT INTO schema_version (version) VALUES (?)",
			(CURRENT_SCHEMA_VERSION,)
			)
	else:
		# Future migration steps go here, e.g.:
		# if row["version"] < 2:
		#     connection.execute("ALTER TABLE ...")
		#     connection.execute("UPDATE schema_version SET version = 2")
		pass
	connection.commit()
	connection.close()

def get_or_create_device(hardware_id, device_name, firmware):
	now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	row = connection.execute(
		"""
		SELECT id FROM devices WHERE hardware_id = ?
		""",
		(hardware_id,)
		).fetchone()
	if row is None:
		cursor = connection.execute(
			"""
			INSERT INTO devices (hardware_id, device_name, firmware, first_seen) VALUES (?,?,?,?)
			""",
			(hardware_id, device_name, firmware, now)
			)
		device_id = cursor.lastrowid
		connection.execute(
			"""
			INSERT INTO device_status (device_id, online, rssi, uptime, last_seen) VALUES (?,?,?,?,?)
			""",
			(device_id, 0, None, None, now)
			)
	else:
		device_id = row["id"]
		connection.execute(
			"""
			UPDATE devices SET firmware = COALESCE(?, firmware), device_name=? WHERE id = ?
			""",
			(firmware, device_name, device_id)
			)
	connection.commit()
	connection.close()
	return device_id
	
def update_device_status(hardware_id, device_name, firmware, online, rssi, uptime):
	now = datetime.now(timezone.utc).isoformat()
	device_id = get_or_create_device(hardware_id, device_name, firmware)
	connection = get_connection()
	connection.execute(
		"""
		UPDATE device_status SET online=?, rssi=?, uptime=?, last_seen=? WHERE device_id=?
		""",
		(online, rssi, uptime, now, device_id)
		)
	connection.commit()
	connection.close()

def save_telemetry(device_id, temperature, valid, rssi, uptime):
	now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	connection.execute(
		"""
		INSERT INTO telemetry (device_id, timestamp, temperature, valid, rssi, uptime) VALUES (?,?,?,?,?,?)
		""",
		(device_id, now, temperature, valid, rssi, uptime)
		)
	connection.commit()
	connection.close()

def mark_offline_devices(timeout_seconds=30):
	now = datetime.now(timezone.utc)
	connection = get_connection()
	rows = connection.execute(
		"""
		SELECT device_id, last_seen FROM device_status WHERE online=?
		""",
		(1,)
		).fetchall()
	for device_id, last_seen in rows:
		last_seen_time = datetime.fromisoformat(last_seen)
		if (now - last_seen_time).total_seconds() > timeout_seconds:
			connection.execute(
				"""
				UPDATE device_status SET online=? WHERE device_id=?
				""",
				(0, device_id)
				)
	connection.commit()
	connection.close()
