import sqlite3

from config import DATABASE_PATH

def get_connection():
	connection = sqlite3.connect(DATABASE_PATH)
	connection.row_factory = sqlite3.Row
	connection.execute("PRAGMA foreign_keys = ON")
	connection.execute("PRAGMA journal_mode = WAL")
	return connection