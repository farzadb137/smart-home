from flask import Blueprint, jsonify, request, current_app, redirect
from werkzeug.security import generate_password_hash

from database import create_initial_admin, init_database, is_setup_complete
from hub_app.auth import MIN_PASSWORD_LENGTH


bp = Blueprint("setup", __name__)

def _valid_username(username):
	return bool(username) and len(username) <= 64 and username.strip() == username

@bp.route("/setup")
def setup_page():
	if is_setup_complete():
		return redirect("/login")
	return current_app.send_static_file("setup.html")

@bp.route("/api/setup", methods=["POST"])
def complete_setup():
	init_database()
	if is_setup_complete():
		return jsonify({"error": "Setup has already been complete"}), 409

	data = request.get_json(silent=True) or {}
	username = (data.get("username") or "").strip()
	password = data.get("password") or ""
	confirm_password = data.get("confirm_password") or ""

	if not _valid_username(username):
		return jsonify({"error": "Invalid username"}), 400
	if len(password) < MIN_PASSWORD_LENGTH:
		return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400
	if password != confirm_password:
		return jsonify({"error": "Passwords do not match"}), 400

	user_id = create_initial_admin(username, generate_password_hash(password))
	if user_id is None:
		return jsonify({"error": "Setup has already been completed"}), 409

	return jsonify({"success": True}), 201