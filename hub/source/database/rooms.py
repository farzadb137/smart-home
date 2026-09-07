from .connection import get_connection
from datetime import datetime, timezone


def list_rooms():
    connection = get_connection()
    rows = connection.execute(
        "SELECT id, name, icon, sort_order, created_at, updated_at FROM rooms ORDER BY sort_order, name COLLATE NOCASE"
    ).fetchall()
    connection.close()
    return rows


def get_room(room_id):
    connection = get_connection()
    row = connection.execute(
        "SELECT id, name, icon, sort_order, created_at, updated_at FROM rooms WHERE id=?",
        (room_id,)
    ).fetchone()
    connection.close()
    return row


def create_room(name, icon="room", sort_order=None):
    connection = get_connection()
    if sort_order is None:
        row = connection.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM rooms").fetchone()
        sort_order = row["next_order"]
    cursor = connection.execute(
        "INSERT INTO rooms (name, icon, sort_order, created_at, updated_at) VALUES (?,?,?,?,datetime('now'))",
        (name, icon or "room", sort_order, datetime.now(timezone.utc).isoformat())
    )
    connection.commit()
    room_id = cursor.lastrowid
    connection.close()
    return room_id


def update_room(room_id, name=None, icon=None, sort_order=None):
    connection = get_connection()
    current = connection.execute("SELECT id, name, icon, sort_order FROM rooms WHERE id=?", (room_id,)).fetchone()
    if current is None:
        connection.close()
        return False
    connection.execute(
        "UPDATE rooms SET name=?, icon=?, sort_order=?, updated_at=datetime('now') WHERE id=?",
        (
            current["name"] if name is None else name,
            current["icon"] if icon is None else icon,
            current["sort_order"] if sort_order is None else sort_order,
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
