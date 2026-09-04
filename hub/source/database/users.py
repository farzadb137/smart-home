from .connection import get_connection


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

def set_user_password(username, password_hash):
	connection = get_connection()
	connection.execute(
		"""
		INSERT INTO users (username, password_hash) VALUES (?,?)
		ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash
		""",
		(username, password_hash)
	)
	connection.commit()
	connection.close()