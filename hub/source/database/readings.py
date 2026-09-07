from datetime import datetime, timezone, timedelta

from config import RAW_TELEMETRY_RETENTION_DAYS

from .connection import get_connection



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
		SELECT
			r.device_id,
			r.capability,
			r.value,
			r.timestamp
		FROM readings r
		INNER JOIN (
			SELECT
				device_id,
				capability,
				MAX(timestamp) AS max_timestamp
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

def get_latest_readings_by_hardware_ids(hardware_ids):
	if not hardware_ids:
		return {}
	connection = get_connection()
	normalized = [str(value).upper() for value in hardware_ids]
	placeholders = ",".join("?" for _ in normalized)
	rows = connection.execute(
		f"""
		SELECT
			d.hardware_id,
			r.capability,
			r.value,
			r.timestamp
		FROM readings r
		JOIN devices d ON d.id = r.device_id
		INNER JOIN (
			SELECT
				device_id,
				capability,
				MAX(timestamp) AS max_timestamp
			FROM readings
			GROUP BY device_id, capability
		) latest
			ON r.device_id = latest.device_id
			AND r.capability = latest.capability
			AND r.timestamp = latest.max_timestamp
		WHERE printf('%012X', d.hardware_id) IN ({placeholders})
		""",
		normalized
	).fetchall()
	connection.close()
	result = {}
	for row in rows:
		hardware_id = f"{row['hardware_id']:012X}"
		result.setdefault(hardware_id, {})[row['capability']] = {
			"value": row["value"],
			"timestamp": row["timestamp"]
		}
	return result

def get_device_history(hardware_id, capability, range_key):
	now = datetime.now(timezone.utc)
	connection = get_connection()

	if range_key == "24h":
		cutoff = (now - timedelta(hours=24)).isoformat()
		rows = connection.execute(
			"""
			SELECT
				timestamp,
				value AS value_avg,
				value AS value_min,
				value AS value_max
			FROM readings
			WHERE
				device_id=(SELECT id FROM devices WHERE hardware_id=?)
				AND capability=?
				AND timestamp >= ?
				AND valid=1
			ORDER BY timestamp ASC
			""",
			(hardware_id, capability, cutoff)
		).fetchall()
	elif range_key in ("7d", "30d", "90d", "1y"):
		days = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
            "1y": 365,
        }[range_key]
		cutoff = (now - timedelta(days=days)).isoformat()
		rows = connection.execute(
			"""
			SELECT
				hour_start AS timestamp,
				value_avg,
				value_min,
				value_max
			FROM readings_hourly
			WHERE
				device_id=(SELECT id FROM devices WHERE hardware_id=?)
				AND capability=?
				AND hour_start >= ?
			ORDER BY hour_start ASC
			""",
			(hardware_id, capability, cutoff)
		).fetchall()
	else:
		connection.close()
		return None

	connection.close()
	return [dict(row) for row in rows]

def rollup_and_prune(retention_days=RAW_TELEMETRY_RETENTION_DAYS):
	now = datetime.now(timezone.utc)
	cutoff = (now - timedelta(days=retention_days)).isoformat()
	current_hour = now.replace(minute=0, second=0, microsecond=0).isoformat()

	connection = get_connection()
	connection.execute(
		"""
		INSERT INTO readings_hourly
			(device_id, capability, hour_start, sample_count, value_avg, value_min, value_max, rssi_avg)
		SELECT
			device_id,
			capability,
			strftime('%Y-%m-%dT%H:00:00', timestamp) AS hour_start,
			COUNT(*),
			AVG(value),
			MIN(value),
			MAX(value),
			AVG(rssi)
		FROM readings
		WHERE valid = 1 AND timestamp < ?
		GROUP BY device_id, capability, hour_start
		ON CONFLICT(device_id, capability, hour_start) DO NOTHING
		""",
		(current_hour,)
	)

	cursor = connection.execute("DELETE FROM readings WHERE timestamp < ?", (cutoff,))
	deleted = cursor.rowcount

	connection.commit()
	connection.close()

	return deleted