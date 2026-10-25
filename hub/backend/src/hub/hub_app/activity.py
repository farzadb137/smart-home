from flask import Blueprint, jsonify, request
from database import list_activity
from hub_app.auth import login_required


bp = Blueprint("activity", __name__)

@bp.route("/api/activity")
@login_required
def activity_list():
	try:
		limit = int(request.args.get("limit", 50))
	except ValueError:
		limit = 50
	before_id = request.args.get("before")
	try:
		before_id = int(before_id) if before_id else None
	except ValueError:
		return jsonify({"error": "Invalid before id"}), 400
	return jsonify(list_activity(limit, before_id))
	