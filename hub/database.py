import sqlite3
from config import DATABASE_PATH
from datetime import datetime, timezone


def get_connection():
	connection = sqlite3.connect(DATABASE_PATH)
	connection.execute("PRAGMA foreign_keys = ON")
	connection.execute("PRAGMA journal_mode = WAL")
	return connection

def init_database_v2():
	connection = get_connection()
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS devices(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			device_name TEXT NOT NULL UNIQUE,
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
		"""
		CREATE INDEX IF NOT EXISTS idx_telemetry_device_timestamp ON telemetry (device_id, timestamp)
		"""
		)
	connection.commit()
	connection.close()

def migrate_to_v2():
	old_devices = False
	connection = get_connection()
	columns = connection.execute(
		"""
		PRAGMA table_info(devices)
		"""
		).fetchall()
	for col in columns:
		if col[1] == "online":
			connection.execute(
				"""
				ALTER TABLE devices RENAME TO devices_old
				"""
				)
			old_devices = True
			break

	init_database_v2()

	if old_devices:
		devices = connection.execute(
			"""
			SELECT * FROM devices_old
			"""
			).fetchall()
		for id, device_name, firmware, first_seen, last_seen, online, rssi, uptime in devices:
			connection.execute(
				"""
				INSERT INTO devices (id, device_name, firmware, first_seen) VALUES (?,?,?,?)
				""", 
				(id, device_name, firmware, first_seen)
				)
			connection.execute(
				"""
				INSERT INTO device_status (device_id, online, rssi, uptime, last_seen) VALUES (?, ?,?,?,?)
				""", 
				(id, online, rssi, uptime, last_seen)
				)
		connection.execute(
			"""
			DROP TABLE devices_old
			"""
			)
		connection.execute(
			"""
			INSERT INTO schema_version (version) VALUES (?)
			""",
			(2,)
			)

	connection.commit()
	connection.close()

def get_or_create_device(device_name, firmware):
	now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	row = connection.execute(
		"""
		SELECT id FROM devices WHERE device_name = ?
		""",
		(device_name,)
		).fetchone()
	if row is None:
		curser = connection.execute(
			"""
			INSERT INTO devices (device_name, firmware, first_seen) VALUES (?,?,?)
			""",
			(device_name, firmware, now)
			)
		device_id = curser.lastrowid
		connection.execute(
			"""
			INSERT INTO device_status (device_id, online, rssi, uptime, last_seen) VALUES (?,?,?,?,?)
			""",
			(device_id, 0, None, None, now)
			)
	else:
		device_id = row[0]
		connection.execute(
			"""
			UPDATE devices SET firmware = ? WHERE id = ?
			""",
			(firmware, device_id)
			)
	connection.commit()
	connection.close()
	return device_id
	
def update_device_status(device_name, firmware, online, rssi, uptime):
	now = datetime.now(timezone.utc).isoformat()
	device_id = get_or_create_device(device_name, firmware)
	connection = get_connection()
	connection.execute(
		"""
		UPDATE device_status SET online=?, rssi=?, uptime=?, last_seen=? WHERE device_id=?
		""",
		(online, rssi, uptime, now, device_id)
		)
	connection.commit()
	connection.close()

def save_telemetry(device_id, temperature, rssi, uptime):
	now = datetime.now(timezone.utc).isoformat()
	connection = get_connection()
	connection.execute(
		"""
		INSERT INTO telemetry (device_id, timestamp, temperature, rssi, uptime) VALUES (?,?,?,?,?)
		""",
		(device_id, now, temperature, rssi, uptime)
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
