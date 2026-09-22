import json
from .connection import get_connection


def _row(row):
    if row is None:
        return None
    try:
        config = json.loads(row['config'] or '{}')
    except (TypeError, ValueError):
        config = {}
    return {
        'id': row['id'], 'name': row['name'], 'enabled': bool(row['enabled']),
        'config': config, 'created_at': row['created_at'], 'updated_at': row['updated_at'],
        'last_triggered_at': row['last_triggered_at']
    }


def list_automations():
    connection = get_connection()
    rows = connection.execute('SELECT * FROM automations ORDER BY id DESC').fetchall()
    connection.close()
    return [_row(row) for row in rows]


def get_automation(automation_id):
    connection = get_connection()
    row = connection.execute('SELECT * FROM automations WHERE id=?', (automation_id,)).fetchone()
    connection.close()
    return _row(row)


def create_automation(name, config, enabled=True):
    import datetime
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    connection = get_connection()
    cursor = connection.execute(
        'INSERT INTO automations(name, enabled, config, created_at, updated_at) VALUES(?,?,?,?,?)',
        (name, 1 if enabled else 0, json.dumps(config, separators=(',', ':')), now, now)
    )
    connection.commit()
    automation_id = cursor.lastrowid
    connection.close()
    return get_automation(automation_id)


def update_automation(automation_id, name, config, enabled):
    import datetime
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    connection = get_connection()
    connection.execute(
        'UPDATE automations SET name=?, enabled=?, config=?, updated_at=? WHERE id=?',
        (name, 1 if enabled else 0, json.dumps(config, separators=(',', ':')), now, automation_id)
    )
    connection.commit()
    connection.close()
    return get_automation(automation_id)


def delete_automation(automation_id):
    connection = get_connection()
    cursor = connection.execute('DELETE FROM automations WHERE id=?', (automation_id,))
    connection.commit()
    deleted = cursor.rowcount > 0
    connection.close()
    return deleted


def mark_triggered(automation_id):
    import datetime
    now = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
    connection = get_connection()
    connection.execute('UPDATE automations SET last_triggered_at=?, updated_at=? WHERE id=?', (now, now, automation_id))
    connection.commit()
    connection.close()
