BROKER_HOST = "127.0.0.1"
BROKER_PORT = 1883
BROKER_USERNAME = "hub_collector"
BROKER_PASSWORD = "jRAxi4YjSw9CqKFMQdK7gYcR"

MQTT_URI_FOR_DEVICES = "mqtts://192.168.1.160:8883"

MOSQUITTO_PASSWD_FILE = "/etc/mosquitto/passwd"

TELEMETRY_TOPIC = "home/devices/+/telemetry"
STATUS_TOPIC = "home/devices/+/status"

DATABASE_PATH = "telemetry.db"

RAW_TELEMETRY_RETENTION_DAYS = 90