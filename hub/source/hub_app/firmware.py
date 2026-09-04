import hashlib
import os
import re
import struct

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from config import FIRMWARE_BASE_URL
from hub_app.auth import login_required
from hub_app.config import HARDWARE_ID_PATTERN
from hub_app.config import APP_DESC_MAGIC, APP_DESC_OFFSET, FIRMWARE_DIR
from hub_app.devices import _resolve_parent_hardware_id_hex
from hub_app.mqtt_commander import send_device_command

bp = Blueprint("firmware", __name__)

def parse_firmware_description(binary_data):
	if len(binary_data) < APP_DESC_OFFSET + 0x50:
		return None

	magic = struct.unpack_from("<I", binary_data, APP_DESC_OFFSET)[0]
	if magic != APP_DESC_MAGIC:
		return None

	version_bytes = binary_data[APP_DESC_OFFSET + 0x10:APP_DESC_OFFSET + 0x10 + 32]
	project_bytes = binary_data[APP_DESC_OFFSET + 0x30:APP_DESC_OFFSET + 0x30 + 32]

	version = version_bytes.split(b"\x00", 1)[0].decode("utf-8", errors="replace")
	project_name = project_bytes.split(b"\x00", 1)[0].decode("utf-8", errors="replace")

	return {"version": version, "project_name": project_name}

@bp.route("/api/devices/<hardware_id_hex>/firmware", methods=["POST"])
@login_required
def upload_firmware(hardware_id_hex):
	if not re.match(HARDWARE_ID_PATTERN, hardware_id_hex):
		return jsonify({"error": "Invalid device ID"}), 400

	hardware_id_hex = hardware_id_hex.upper()
	found, parent_hardware_id_hex = _resolve_parent_hardware_id_hex(hardware_id_hex)
	if not found:
		return jsonify({"success": False, "error": "Device not found"}), 404

	if "firmware" not in request.files:
		return jsonify({"success": False, "error": "No firmware file provided"}), 400

	binary_data = request.files["firmware"].read()
	description = parse_firmware_description(binary_data)
	if description is None:
		return jsonify({"success": False, "error": "Not a valid ESP-IDF firmware image (app description header not found)"}), 400

	sha256_hex = hashlib.sha256(binary_data).hexdigest()
	filename = secure_filename(f"{description['project_name']}_{description['version']}.bin")
	os.makedirs(FIRMWARE_DIR, exist_ok=True)
	with open(os.path.join(FIRMWARE_DIR, filename), "wb") as file:
		file.write(binary_data)

	url = f"{FIRMWARE_BASE_URL}/firmware/{filename}"
	command_payload = {
		"command": "ota_update",
		"data": {
			"url": url,
			"version": description["version"],
			"sha256": sha256_hex
		}
	}

	ok, response = send_device_command(hardware_id_hex, command_payload, parent_hardware_id_hex)
	if not ok:
		return jsonify({"success": False, "error": response.get("error", "Device did not acknowledge the update")}), 504

	response.setdefault("data", {})
	response["data"]["version"] = description["version"]
	response["data"]["project_name"] = description["project_name"]

	return jsonify(response)

@bp.route("/firmware/<path:filename>")
def get_firmware(filename):
	return send_from_directory(FIRMWARE_DIR, filename, mimetype="application/octet-stream")