import os
import re
import secrets
import subprocess
import threading
import time

from flask import Blueprint, jsonify, request

from config import MOSQUITTO_PASSWD_FILE, MQTT_URI_FOR_DEVICES
from database import get_or_create_device
from hub_app.auth import login_required
from hub_app.config import CLAIM_CODE_CHARSET, CLAIM_CODE_LENGTH, CLAIM_WINDOW_SECONDS

bp = Blueprint("provisioning", __name__)

_pending_claims = {}
_claims_lock = threading.Lock()

def _generate_claim_code():
	return "".join(secrets.choice(CLAIM_CODE_CHARSET) for _ in range(CLAIM_CODE_LENGTH))

def _cleanup_expired_claims():
	now = time.time()
	expired = [code for code, claim in _pending_claims.items() if claim["expires_at"] < now]
	for code in expired:
		del _pending_claims[code]

def _provision_mqtt_credentials(username):
	password = secrets.token_urlsafe(18)

	if os.path.exists(MOSQUITTO_PASSWD_FILE):
		command = ["sudo", "mosquitto_passwd", "-b", MOSQUITTO_PASSWD_FILE, username, password]
	else:
		command = ["sudo", "mosquitto_passwd", "-c", "-b", MOSQUITTO_PASSWD_FILE, username, password]

	subprocess.run(command, check=True, capture_output=True, text=True)
	subprocess.run(["sudo", "systemctl", "reload", "mosquitto"], check=True, capture_output=True, text=True)

	return password

@bp.route("/api/provision/start", methods=["POST"])
@login_required
def provision_start():
	with _claims_lock:
		_cleanup_expired_claims()
		code = _generate_claim_code()
		while code in _pending_claims:
			code = _generate_claim_code()
		_pending_claims[code] = {"expires_at": time.time() + CLAIM_WINDOW_SECONDS}

	return jsonify({"success": True, "data": {"code": code, "expires_in": CLAIM_WINDOW_SECONDS}})

@bp.route("/api/provision/claim", methods=["POST"])
def provision_claim():
	payload = request.get_json(silent=True) or {}
	claim_code = (payload.get("claim_code") or "").strip().upper()
	hardware_id = (payload.get("hardware_id") or "").strip().upper()
	device_type = payload.get("device_type")

	if not re.match(r"^[0-9A-F]{12}$", hardware_id):
		return jsonify({"success": False, "error": "Invalid hardware_id"}), 400

	with _claims_lock:
		_cleanup_expired_claims()
		claim = _pending_claims.pop(claim_code, None)

	if claim is None:
		return jsonify({"success": False, "error": "Invalid or expired claim code"}), 400

	try:
		password = _provision_mqtt_credentials(hardware_id)
	except subprocess.CalledProcessError as error:
		print(f"[PROVISION] Credential generation failed: {error.stderr}")
		return jsonify({"success": False, "error": "Failed to generate device credentials"}), 500

	get_or_create_device(int(hardware_id, 16), None, device_type, None)

	print(f"[PROVISION] Claimed device {hardware_id}")

	return jsonify({"success": True, "data": {"mqtt_uri": MQTT_URI_FOR_DEVICES, "mqtt_username": hardware_id, "mqtt_password": password}})

