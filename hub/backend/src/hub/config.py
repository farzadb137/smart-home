import os
import importlib.util

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

# PROJECT_ROOT in this file is <repo>/hub, so REPO_ROOT is <repo>/
REPO_ROOT = os.path.dirname(PROJECT_ROOT)
GENERATED_TOPICS_PY = os.path.join(REPO_ROOT, "protocol", "generated", "topics.py")

def _load_generated_topics():
    defaults = {
        "TOPIC_TELEMETRY": "home/devices/{device_id}/telemetry",
        "TOPIC_STATUS": "home/devices/{device_id}/status",
        "TOPIC_RESPONSE": "home/devices/{device_id}/response",
        "TOPIC_COMMAND": "home/devices/{device_id}/command",
        "TOPIC_CHILD_TELEMETRY": "home/devices/{device_id}/children/{child_id}/telemetry",
        "TOPIC_CHILD_STATUS": "home/devices/{device_id}/children/{child_id}/status",
        "TOPIC_CHILD_COMMAND": "home/devices/{device_id}/children/{child_id}/command",
        "TOPIC_CHILD_RESPONSE": "home/devices/{device_id}/children/{child_id}/response",
        "TOPIC_TIME": "home/time",
    }
    try:
        spec = importlib.util.spec_from_file_location("generated_topics", GENERATED_TOPICS_PY)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for k in defaults:
            if hasattr(mod, k):
                defaults[k] = getattr(mod, k)
    except Exception as e:
        print(f"[CONFIG] Could not load {GENERATED_TOPICS_PY}, using fallbacks: {e}")
    return defaults

_GENERATED = _load_generated_topics()

def _sub(pattern):
    # "home/devices/{device_id}/telemetry" -> "home/devices/+/telemetry"
    return pattern.replace("{device_id}", "+").replace("{child_id}", "+")

TELEMETRY_TOPIC = _env("TELEMETRY_TOPIC", _sub(_GENERATED["TOPIC_TELEMETRY"]))
STATUS_TOPIC = _env("STATUS_TOPIC", _sub(_GENERATED["TOPIC_STATUS"]))
CHILD_TELEMETRY_TOPIC = _env("CHILD_TELEMETRY_TOPIC", _sub(_GENERATED["TOPIC_CHILD_TELEMETRY"]))
CHILD_STATUS_TOPIC = _env("CHILD_STATUS_TOPIC", _sub(_GENERATED["TOPIC_CHILD_STATUS"]))
RESPONSE_SUB = _env("RESPONSE_SUB", _sub(_GENERATED["TOPIC_RESPONSE"]))
CHILD_RESPONSE_SUB = _env("CHILD_RESPONSE_SUB", _sub(_GENERATED["TOPIC_CHILD_RESPONSE"]))
TIME_SYNC_TOPIC = _env("TIME_SYNC_TOPIC", _GENERATED["TOPIC_TIME"])

# publish helpers - single place that formats topics
def format_command_topic(device_hex, parent_hex=None):
    if parent_hex:
        return _GENERATED["TOPIC_CHILD_COMMAND"].replace("{device_id}", parent_hex).replace("{child_id}", device_hex)
    return _GENERATED["TOPIC_COMMAND"].replace("{device_id}", device_hex)

RAW_TELEMETRY_RETENTION_DAYS = int(_env("RAW_TELEMETRY_RETENTION_DAYS", "90"))

MQTT_URI_FOR_DEVICES = _env("MQTT_URI_FOR_DEVICES", "mqtts://192.168.1.160:8883")
FIRMWARE_BASE_URL = _env("FIRMWARE_BASE_URL", "https://192.168.1.160:5000")

MOSQUITTO_PASSWD_FILE = _env("MOSQUITTO_PASSWD_FILE", "/etc/mosquitto/passwd")

HUB_COMMANDER_USERNAME = _env("HUB_COMMANDER_USERNAME", "hub_commander")
HUB_COMMANDER_PASSWORD = _require_env("HUB_COMMANDER_PASSWORD")

COMMAND_RESPONSE_TIMEOUT_SEC = float(_env("COMMAND_RESPONSE_TIMEOUT_SEC", "5"))