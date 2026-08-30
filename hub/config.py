import os

def _require_env(name):
	value = os.environ.get(name)
	if not value:
		raise RuntimeError(
			f"Missing required environment variable '{name}'. "
			f"Set it in /etc/iot-hub/secrets.env and ensure the systemd unit "
			f"has 'EnvironmentFile=/etc/iot-hub/secrets.env' before starting this service."
		)
	return value

BROKER_HOST = "127.0.0.1"
BROKER_PORT = 8883
BROKER_USERNAME = "hub_collector"
BROKER_PASSWORD = _require_env("BROKER_PASSWORD")

TELEMETRY_TOPIC = "home/devices/+/telemetry"
STATUS_TOPIC = "home/devices/+/status"

DATABASE_PATH = "telemetry.db"

RAW_TELEMETRY_RETENTION_DAYS = 90

# Not secrets - devices need to be told these addresses, so there's no
# confidentiality benefit to moving them out of source. Just update these
# to your hub's real LAN IP.
MQTT_URI_FOR_DEVICES = "mqtts://192.168.1.160:8883"
FIRMWARE_BASE_URL = "https://192.168.1.160:5000"

MOSQUITTO_PASSWD_FILE = "/etc/mosquitto/passwd"

HUB_COMMANDER_USERNAME = "hub_commander"
HUB_COMMANDER_PASSWORD = _require_env("HUB_COMMANDER_PASSWORD")

COMMAND_RESPONSE_TIMEOUT_SEC = 5