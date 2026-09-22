import os
import secrets
from datetime import timedelta


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
FIRMWARE_DIR = os.path.join(PROJECT_ROOT, "firmware")
SECRET_KEY_PATH = os.path.join(BASE_DIR, ".flask_secret_key")

VALID_HISTORY_RANGES = {"24h", "7d", "30d", "90d", "1y"}
HARDWARE_ID_PATTERN = r"^(?:[0-9A-Fa-f]{12}|[0-9A-Fa-f]{16})$"

APP_DESC_MAGIC = 0xABCD5432
APP_DESC_OFFSET = 0x20

CLAIM_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
CLAIM_CODE_LENGTH = 6
CLAIM_WINDOW_SECONDS = 120

def load_or_create_secret_key():
	if os.path.exists(SECRET_KEY_PATH):
		with open(SECRET_KEY_PATH, "r") as file:
			return file.read().strip()

	key = secrets.token_hex(32)
	with open(SECRET_KEY_PATH, "w") as file:
		file.write(key)
	os.chmod(SECRET_KEY_PATH, 0o600)
	return key

def flask_settings():
    return {
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SECURE": True,
        "SESSION_COOKIE_SAMESITE": "Lax",
        "PERMANENT_SESSION_LIFETIME": timedelta(days=30),
        "MAX_CONTENT_LENGTH": 4 * 1024 * 1024,
    }