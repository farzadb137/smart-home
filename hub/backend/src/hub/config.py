import os

def _require_env(name):
	value = os.environ.get(name)
	if not value:
		raise RuntimeError(
			f"Missing required environment variable '{name}'. "
			f"Set it in /etc/smart-hub/secrets.env and ensure the systemd unit "
			f"has 'EnvironmentFile=/etc/smart-hub/secrets.env' before starting this service."
		)
	return value

def _env(name, default):
	value = os.environ.get(name)
	return value if value else default

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
# <repo>/hub  (this file is <repo>/hub/backend/src/hub/config.py)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(PROJECT_DIR)))
DATABASE_PATH = _env("DATABASE_PATH", os.path.join(PROJECT_ROOT, "data", "smart.db"))

BROKER_HOST = _env("BROKER_HOST", "127.0.0.1")
BROKER_PORT = int(_env("BROKER_PORT", "1883"))

BROKER_USERNAME = _env("BROKER_USERNAME", "hub_collector")
BROKER_PASSWORD = _require_env("BROKER_PASSWORD")

TELEMETRY_TOPIC = _env("TELEMETRY_TOPIC", "home/devices/+/telemetry")
STATUS_TOPIC = _env("STATUS_TOPIC", "home/devices/+/status")
CHILD_TELEMETRY_TOPIC = _env("CHILD_TELEMETRY_TOPIC", "home/devices/+/children/+/telemetry")
CHILD_STATUS_TOPIC = _env("CHILD_STATUS_TOPIC", "home/devices/+/children/+/status")

RAW_TELEMETRY_RETENTION_DAYS = int(_env("RAW_TELEMETRY_RETENTION_DAYS", "90"))

MQTT_URI_FOR_DEVICES = _env("MQTT_URI_FOR_DEVICES", "mqtts://192.168.1.160:8883")
FIRMWARE_BASE_URL = _env("FIRMWARE_BASE_URL", "https://192.168.1.160:5000")

MOSQUITTO_PASSWD_FILE = _env("MOSQUITTO_PASSWD_FILE", "/etc/mosquitto/passwd")

HUB_COMMANDER_USERNAME = _env("HUB_COMMANDER_USERNAME", "hub_commander")
HUB_COMMANDER_PASSWORD = _require_env("HUB_COMMANDER_PASSWORD")

COMMAND_RESPONSE_TIMEOUT_SEC = float(_env("COMMAND_RESPONSE_TIMEOUT_SEC", "5"))