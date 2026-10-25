from .connection import get_connection
from datetime import datetime, timezone


def list_rooms():
    connection = get_connection()
    rows = connection.execute(
        "SELECT id, name, type, sort_order, created_at, updated_at FROM rooms ORDER BY sort_order, name COLLATE NOCASE"
    ).fetchall()
    connection.close()
    return rows


def get_room(room_id):
    connection = get_connection()
    row = connection.execute(
        "SELECT id, name, type, sort_order, created_at, updated_at FROM rooms WHERE id=?",
        (room_id,)
    ).fetchone()
    connection.close()
    return row


def create_room(name, type="room", sort_order=None):
    connection = get_connection()
    if sort_order is None:
        row = connection.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM rooms").fetchone()
        sort_order = row["next_order"]
    now = datetime.now(timezone.utc).isoformat()
    cursor = connection.execute(
        "INSERT INTO rooms (name, type, sort_order, created_at, updated_at) VALUES (?,?,?,?,?)",
        (name, type or "room", sort_order, now, now)
    )
    connection.commit()
    room_id = cursor.lastrowid
    connection.close()
    return room_id


def update_room(room_id, name=None, type=None, sort_order=None):
    connection = get_connection()
    current = connection.execute("SELECT id, name, type, sort_order FROM rooms WHERE id=?", (room_id,)).fetchone()
    if current is None:
        connection.close()
        return False
    connection.execute(
        "UPDATE rooms SET name=?, type=?, sort_order=?, updated_at=? WHERE id=?",
        (
            current["name"] if name is None else name,
            current["type"] if type is None else type,
            current["sort_order"] if sort_order is None else sort_order,
            datetime.now(timezone.utc).isoformat(),
            room_id,
        )
    )
    connection.commit()
    connection.close()
    return True


def delete_room(room_id):
    connection = get_connection()
    cursor = connection.execute("DELETE FROM rooms WHERE id=?", (room_id,))
    connection.commit()
    connection.close()
    return cursor.rowcount > 0


def assign_device_to_room(hardware_id, room_id):
    connection = get_connection()
    if room_id is not None:
        exists = connection.execute("SELECT id FROM rooms WHERE id=?", (room_id,)).fetchone()
        if exists is None:
            connection.close()
            return False, "Room not found"
    device = connection.execute("SELECT id FROM devices WHERE hardware_id=?", (hardware_id,)).fetchone()
    if device is None:
        connection.close()
        return False, "Device not found"
    connection.execute("UPDATE devices SET room_id=? WHERE id=?", (room_id, device["id"]))
    connection.commit()
    connection.close()
    return True, None
