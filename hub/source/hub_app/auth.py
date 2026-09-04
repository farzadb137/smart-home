from functools import wraps

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash

from database import get_user, get_user_by_id

bp = Blueprint("auth", __name__)

def login_required(view):
	@wraps(view)
	def wrapped(*args, **kwargs):
		user_id = session.get("user_id")
		if not user_id:
			return jsonify({"error": "Authentication required"}), 401

		user = get_user_by_id(user_id)
		if user is None:
			session.clear()
			return jsonify({"error": "Authentication required"}), 401

		session["username"] = user["username"]
		return view(*args, **kwargs)

	return wrapped

@bp.route("/api/login", methods=["POST"])
def login():
	data = request.get_json(silent=True) or request.form
	username = (data.get("username") or "").strip()
	password = data.get("password") or ""

	user = get_user(username)
	if (user is None) or (not check_password_hash(user["password_hash"], password)):
		return jsonify({"error": "Invalid username or password"}), 401

	session.clear()
	session.permanent = True
	session["user_id"] = user["id"]
	session["username"] = user["username"]

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
	if user is None:
		session.clear()
		return jsonify({"authenticated": False})

	session["username"] = user["username"]

	return jsonify({"authenticated": True, "username": user["username"]})