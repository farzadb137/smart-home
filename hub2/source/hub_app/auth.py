from functools import wraps

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from database import (
	count_enabled_administrators,
	create_user,
	delete_user,
	get_user,
	get_user_by_id,
	is_setup_complete,
	list_users,
	user_count,
	update_user
)

bp = Blueprint("auth", __name__)

MIN_PASSWORD_LENGTH = 8
VALID_ROLES = {"administrator", "user"}

def _public_user(row):
	return {
		"id": row["id"],
		"username": row["username"],
		"role": row["role"],
		"enabled": row["enabled"],
		"created_at": row["created_at"],
		"updated_at": row["updated_at"]
	}

def _validate_username(username):
	return bool(username) and len(username) <= 64 and username.strip() == username

def _validate_password(password):
	return isinstance(password, str) and len(password) >= MIN_PASSWORD_LENGTH

def login_required(view):
	@wraps(view)
	def wrapped(*args, **kwargs):
		user_id = session.get("user_id")
		if not user_id:
			return jsonify({"error": "Authentication required"}), 401

		user = get_user_by_id(user_id)
		if user is None or not user["enabled"]:
			session.clear()
			return jsonify({"error": "Authentication required"}), 401

		session["username"] = user["username"]
		return view(*args, **kwargs)

	return wrapped

def admin_required(view):
	@wraps(view)
	def wrapped(*args, **kwargs):
		user_id = session.get("user_id")
		if not user_id:
			return jsonify({"error": "Authentication required"}), 401

		user = get_user_by_id(user_id)
		if user is None or not user["enabled"]:
			session.clear()
			return jsonify({"error": "Authentication required"}), 401

		if user["role"] != "administrator":
			return jsonify({"error": "Administrator access required"}), 403

		session["username"] = user["username"]
		return view(*args, **kwargs)

	return wrapped

@bp.route("/api/login", methods=["POST"])
def login():
	data = request.get_json(silent=True) or request.form
	username = (data.get("username") or "").strip()
	password = data.get("password") or ""

	user = get_user(username)
	if (user is None) or (not user["enabled"]) or (not check_password_hash(user["password_hash"], password)):
		return jsonify({"error": "Invalid username or password"}), 401

	session.clear()
	session.permanent = True
	session["user_id"] = user["id"]
	session["username"] = user["username"]
	session["role"] = user["role"]

	return jsonify({"success": True})

@bp.route("/api/logout", methods=["POST"])
def logout():
	session.clear()
	return jsonify({"success": True})

@bp.route("/api/session")
def session_status():
	user_id = session.get("user_id")
	if not user_id:
		return jsonify({"authenticated": False})

	user = get_user_by_id(user_id)
	if user is None or not user["enabled"]:
		session.clear()
		return jsonify({"authenticated": False})

	session["username"] = user["username"]

	return jsonify({"authenticated": True, "username": user["username"], "role": user["role"]})

@bp.route("/api/setup/status")
def setup_status():
	return jsonify({"setup_required": not is_setup_complete(), "user_count": user_count()})

@bp.route("/api/users", methods=["GET"])
@admin_required
def users_list():
	return jsonify([_public_user(row) for row in list_users()])

@bp.route("/api/users", methods=["POST"])
@admin_required
def users_create():
	data = request.get_json(silent=True) or {}
	username = (data.get("username") or "").strip()
	password = data.get("password") or ""
	role = data.get("role") or "user"

	if not _validate_username(username):
		return jsonify({"error": "Invalid username"}), 400
	if not _validate_password(password):
		return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400
	if role not in VALID_ROLES:
		return jsonify({"error": "Invalid role"}), 400

	try:
		user_id = create_user(username, generate_password_hash(password), role)
	except Exception as exc:
		if "UNIQUE constraint failed" in str(exc):
			return jsonify({"error": "Username already exists"}), 409
		raise

	return jsonify({"success": True, "id": user_id}), 201

@bp.route("/api/users/<int:user_id>", methods=["PUT"])
@admin_required
def users_update(user_id):
	current_user_id = session["user_id"]
	current = get_user_by_id(user_id)
	if current is None:
		return jsonify({"error": "User not found"}), 404

	data = request.get_json(silent=True) or {}
	username = data.get("username")
	role = data.get("role")
	enabled = data.get("enabled")
	password = data.get("password")

	if username is not None:
		username = username.strip()
		if not _validate_username(username):
			return jsonify({"error": "Invalid username"}), 400
	if role is not None and role not in VALID_ROLES:
		return jsonify({"error": "Invalid role"}), 400
	if enabled is not None and not isinstance(enabled, bool):
		return jsonify({"error": "enabled must be true or false"}), 400
	if password is not None and password != "" and not _validate_password(password):
		return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400

	target_role = current["role"] if role is None else role
	target_enabled = bool(current["enabled"]) if enabled is None else enabled

	if user_id == current_user_id and (target_role != "administrator" or not target_enabled):
		return jsonify({"error": "You cannot disable or remove administrator access from your own account"}), 400

	if (current["role"] == "administrator") and (current["enabled"]) and (target_role != "administrator" or not target_enabled) and (count_enabled_administrators() <= 1):
		return jsonify({"error": "At least one enabled administrator is required"}), 400

	password_hash = generate_password_hash(password) if password else None
	try:
		update_user(user_id, username, password_hash, role, enabled)
	except Exception as exc:
		if "UNIQUE constraint failed" in str(exc):
			return jsonify({"error": "Username already exists"}), 409
		raise

	if user_id == current_user_id:
		updated = get_user_by_id(user_id)
		session["username"] = updated["username"]
		session["role"] = updated["role"]

	return jsonify({"success": True})

@bp.route("/api/users/<int:user_id>", methods=["DELETE"])
@admin_required
def users_delete(user_id):
	current_user_id = session["user_id"]
	user = get_user_by_id(user_id)
	if user is None:
		return jsonify({"error": "User not found"}), 404
	if user_id == current_user_id:
		return jsonify({"error": "You cannot delete your own account"}), 400
	if user["role"] == "administrator" and user["enabled"] and count_enabled_administrators() <= 1:
		return jsonify({"error": "At least one enabled administrator is required"}), 400

	delete_user(user_id)
	return jsonify({"success": True})










