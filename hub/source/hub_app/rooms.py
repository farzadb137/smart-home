from flask import Blueprint, jsonify, request

from database import (
	assign_device_to_room,
	create_room,
	delete_room,
	get_connection,
	get_room,
	list_rooms,
	update_room
)

from hub_app.auth import login_required

bp = Blueprint("rooms", __name__)


def _serialize_room(row):
	return {
		"id": row["id"],
		"name": row["name"],
		"icon": row["icon"],
		"sort_order": row["sort_order"],
		"created_at": row["created_at"],
		"updated_at": row["updated_at"]
	}

@bp.route("/api/rooms")
@login_required
def get_rooms():
	rooms = list_rooms()
	connection = get_connection()
	device_rows = connection.execute(
		"SELECT id, hardware_id, room_id FROM devices WHERE room_id IS NOT NULL"
	).fetchall()
	connection.close()

	devices_by_room = {}
	for row in device_rows:
		devices_by_room.setdefault(row["room_id"], []).append(f"{row['hardware_id']:012X}")

	payload = []
	for room in rooms:
		item = _serialize_room(room)
		item["device_ids"] = devices_by_room.get(room["id"], [])
		payload.append(item)
	return jsonify(payload)

@bp.route("/api/rooms", methods=["POST"])
@login_required
def create_room_endpoint():
	payload = request.get_json(silent=True) or {}
	name = (payload.get("name") or "").strip()
	icon = (payload.get("icon") or "room").strip() or "room"
	if not name:
		return jsonify({"success": False, "error": "Room name cannot be empty"}), 400
	if len(name) > 64:
		return jsonify({"success": False, "error": "Room name must be 64 characters or fewer"}), 400
	try:
		room_id = create_room(name, icon)
	except Exception as exc:
		if "UNIQUE" in str(exc).upper():
			return jsonify({"success": False, "error": "A room with that name already exists"}), 409
		raise
	return jsonify({"success": True, "room": _serialize_room(get_room(room_id))}), 201

@bp.route("/api/rooms/<int:room_id>", methods=["PUT"])
@login_required
def update_room_endpoint(room_id):
	payload = request.get_json(silent=True) or {}
	name = payload.get("name")
	icon = payload.get("icon")
	sort_order = payload.get("sort_order")
	if name is not None:
		name = name.strip()
		if not name:
			return jsonify({"success": False, "error": "Room name cannot be empty"}), 400
		if len(name) > 64:
			return jsonify({"success": False, "error": "Room name must be 64 characters or fewer"}), 400
		if sort_order is not None and not isinstance(sort_order, int):
			return jsonify({"success": False, "error": "sort_order must be an integer"}), 400
		try:
			updated = update_room(room_id, name=name, icon=icon, sort_order=sort_order)
		except Exception as exc:
			if "UNIQUE" in str(exc).upper():
				return jsonify({"success": False, "error": "A room with that name already exists"}), 409
			raise
		if not updated:
			return jsonify({"success": False, "error": "Room not found"}), 404
		return jsonify({"success": True, "room": _serialize_room(get_room(room_id))})

@bp.route("/api/rooms/<int:room_id>", methods=["DELETE"])
@login_required
def delete_room_endpoint(room_id):
	if not delete_room(room_id):
		return jsonify({"success": False, "error": "Room not found"}), 404
	return jsonify({"success": True})

@bp.route("/api/devices/<hardware_id_hex>/room", methods=["PUT"])
@login_required
def assign_room(hardware_id_hex):
	try:
		hardware_id = int(hardware_id_hex, 16)
	except ValueError:
		return jsonify({"success": False, "error": "Invalid device ID"}), 400
	payload = request.get_json(silent=True) or {}
	room_id = payload.get("room_id")
	if room_id is not None:
		try:
			room_id = int(room_id)
		except (TypeError, ValueError):
			return jsonify({"success": False, "error": "room_id must be an integer or null"}), 400
	ok, error = assign_device_to_room(hardware_id, room_id)
	if not ok:
		return jsonify({"success": False, "error": error}), 404
	return jsonify({"success": True, "room_id": room_id})