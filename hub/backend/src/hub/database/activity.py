from .connection import get_connection


def add_activity(event_type, message, user_id=None, device_id=None, room_id=None, metadata=None):
    import json
    connection = get_connection()
    connection.execute(
        """
        INSERT INTO activity_log (event_type, message, user_id, device_id, room_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        """,
        (event_type, message, user_id, device_id, room_id, json.dumps(metadata or {}, separators=(",", ":")))
    )
    connection.commit()
    connection.close()


def list_activity(limit=50, before_id=None):
    import json
    connection = get_connection()
    params = []
    where = ""
    if before_id is not None:
        where = "WHERE activity_log.id < ?"
        params.append(before_id)
    params.append(max(1, min(int(limit), 100)))
    rows = connection.execute(
        f"""
        SELECT
        	activity_log.id,
        	activity_log.event_type,
        	activity_log.message,
        	activity_log.created_at,
        	users.username,
        	devices.hardware_id,
        	devices.device_name,
        	rooms.name AS room_name,
        	activity_log.metadata
        FROM activity_log
        LEFT JOIN users ON users.id = activity_log.user_id
        LEFT JOIN devices ON devices.id = activity_log.device_id
        LEFT JOIN rooms ON rooms.id = activity_log.room_id
        {where}
        ORDER BY activity_log.id DESC LIMIT ?
        """,
        params
    ).fetchall()
    connection.close()
    result = []
    for row in rows:
        try:
            metadata = json.loads(row["metadata"] or "{}")
        except (TypeError, ValueError):
            metadata = {}
        result.append({
            "id": row["id"],
            "type": row["event_type"],
            "message": row["message"],
            "created_at": row["created_at"],
            "username": row["username"],
            "hardware_id_hex": f"{row['hardware_id']:012X}" if row["hardware_id"] is not None else None,
            "device_name": row["device_name"],
            "room_name": row["room_name"],
            "metadata": metadata,
        })
    return result
