from .connection import get_connection

CURRENT_SCHEMA_VERSION = 1

def init_database():
	connection = get_connection()
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS rooms(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			icon TEXT NOT NULL DEFAULT 'room',
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)
		"""
	)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS devices(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			hardware_id INTEGER NOT NULL UNIQUE,
			parent_device_id INTEGER,
			room_id INTEGER,
			device_name TEXT NOT NULL,
			device_type TEXT NOT NULL DEFAULT 'unknown',
			manufacturer TEXT,
			model TEXT,
			hardware TEXT,
			firmware TEXT,
			first_seen TEXT NOT NULL,
			FOREIGN KEY (parent_device_id) REFERENCES devices(id),
			FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
			)
		"""
	)
	connection.execute("CREATE INDEX IF NOT EXISTS idx_devices_room_id ON devices(room_id)")
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
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS users(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			enabled INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
			)
		"""
	)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS activity_log(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_type TEXT NOT NULL,
			message TEXT NOT NULL,
			user_id INTEGER,
			device_id INTEGER,
			room_id INTEGER,
			metadata TEXT NOT NULL DEFAULT '{}',
			created_at TEXT NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
			FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
			FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
			)
		"""
	)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at)"
	)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_activity_log_device_log ON activity_log (device_id)"
	)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS automations(
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1,
			config TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			last_triggered_at TEXT
			)
		"""
	)
	connection.execute(
		"CREATE INDEX IF NOT EXISTS idx_automations_enabled On automations (enabled)"
	)
	connection.execute(
		"""
		CREATE TABLE IF NOT EXISTS system_settings(
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
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