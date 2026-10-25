from datetime import datetime, timezone

from .connection import get_connection

VALID_ROLES = {"administrator", "user"}

def _utc_now():
	return datetime.now(timezone.utc).isoformat()

def get_user(username):
	connection = get_connection()
	row = connection.execute(
		"SELECT * FROM users WHERE username=?",
		(username,)
	).fetchone()
	connection.close()
	return row

def get_user_by_id(user_id):
	connection = get_connection()
	row = connection.execute(
		"SELECT * FROM users WHERE id=?",
		(user_id,)
	).fetchone()
	connection.close()
	return row

def list_users():
	connection = get_connection()
	rows = connection.execute(
		"""
		SELECT
			id,
			username,
			role,
			enabled,
			created_at,
			updated_at
		FROM users
		ORDER BY username COLLATE NOCASE
		"""
	).fetchall()
	connection.close()
	return rows

def user_count():
	connection = get_connection()
	row = connection.execute(
		"SELECT COUNT(*) AS count FROM users"
	).fetchone()
	connection.close()
	return row["count"]

def has_administrator():
	connection = get_connection()
	row = connection.execute(
		"SELECT 1 FROM users WHERE role='administrator' AND enabled=1 LIMIT 1"
	).fetchone()
	connection.close()
	return row is not None

def is_setup_complete():
	connection = get_connection()
	row = connection.execute(
		"SELECT value FROM system_settings WHERE key='setup_completed'"
	).fetchone()
	connection.close()
	return row is not None and row["value"] == "1"

def set_setup_complete():
	connection = get_connection()
	connection.execute(
		"""
		INSERT INTO system_settings (key, value) VALUES ('setup_completed', '1')
		ON CONFLICT(key) DO UPDATE SET value=excluded.value
		"""
	)
	connection.commit()
	connection.close()

def create_initial_admin(username, password_hash):
	connection = get_connection()
	try:
		connection.execute("BEGIN IMMEDIATE")
		completed = connection.execute(
			"SELECT value FROM system_settings WHERE key='setup_completed'"
		).fetchone()
		existing = connection.execute(
			"SELECT 1 FROM users LIMIT 1"
		).fetchone()
		if(completed is not None and completed["value"] == "1") or existing is not None:
			connection.rollback()
			return None

		now = _utc_now()
		cursor = connection.execute(
			"""
			INSERT INTO users (username, password_hash, role, enabled, created_at, updated_at)
			VALUES (?,?, 'administrator', 1,?,?)
			""",
			(username, password_hash, now, now)
		)
		connection.execute(
			"INSERT INTO system_settings (key, value) VALUES ('setup_completed', '1')"
		)
		connection.commit()
		return cursor.lastrowid
	except Exception:
		connection.rollback()
		raise
	finally:
		connection.close()

def create_user(username, password_hash, role="user"):
	if role not in VALID_ROLES:
		raise ValueError("Invalid user role")

	connection = get_connection()
	try:
		now = _utc_now()
		cursor = connection.execute(
			"""
			INSERT INTO users (username, password_hash, role, enabled, created_at, updated_at)
			VALUES (?,?,?,1,?,?)
			""",
			(username, password_hash, role, now, now)
		)
		connection.commit()
		return cursor.lastrowid
	finally:
		connection.close()

def update_user(user_id, username=None, password_hash=None, role=None, enabled=None):
	connection = get_connection()
	try:
		current = connection.execute(
			"SELECT * FROM users WHERE id=?",
			(user_id,)
		).fetchone()
		if current is None:
			return False

		new_username = current["username"] if username is None else username
		new_password_hash = current["password_hash"] if password_hash is None else password_hash
		new_role = current["role"] if role is None else role
		new_enabled = current["enabled"] if enabled is None else int(bool(enabled))

		if new_role not in VALID_ROLES:
			raise ValueError("Invalid user role")

		connection.execute(
			"""
			UPDATE users
			SET username=?, password_hash=?, role=?, enabled=?, updated_at=?
			WHERE id=?
			""",
			(new_username, new_password_hash, new_role, new_enabled, _utc_now(), user_id)
		)
		connection.commit()
		return True
	finally:
		connection.close()

def delete_user(user_id):
	connection = get_connection()
	try:
		connection.execute(
			"DELETE FROM users WHERE id=?",
			(user_id,)
		)
		deleted = connection.total_changes > 0
		connection.commit()
		return deleted
	finally:
		connection.close()

def count_enabled_administrators():
	connection = get_connection()
	row = connection.execute(
		"SELECT COUNT(*) AS count FROM users WHERE role='administrator' AND enabled=1"
	).fetchone()
	connection.close()
	return row["count"]

def set_user_password(username, password_hash):
	connection = get_connection()
	try:
		now = _utc_now()
		connection.execute(
			"""
			INSERT INTO users (username, password_hash, role, enabled, created_at, updated_at)
			VALUES (?,?, 'administrator', 1, ?,?)
			ON CONFLICT(username) DO
			UPDATE SET password_hash=excluded.password_hash, updated_at=excluded.updated_at, enabled=1
			""",
			(username, password_hash, now, now)
		)
		connection.execute(
			"""
			INSERT INTO system_settings (key, value) VALUES ('setup_completed', '1')
			ON CONFLICT(key) DO UPDATE SET value=excluded.value
			"""
		)
		connection.commit()
	finally:
		connection.close()