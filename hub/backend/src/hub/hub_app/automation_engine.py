import datetime
import threading
import time

from database import add_activity, get_latest_readings_by_hardware_ids, list_automations, mark_triggered
from hub_app.mqtt_commander import send_device_command

_LOCK = threading.Lock()
_LAST_FIRED = {}
_LAST_MATCH = {}
_LAST_SCHEDULE_SLOT = {}
COOLDOWN_SECONDS = 5


def _normalize_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "on", "yes", "open", "opened", "active"}:
            return True
        if normalized in {"0", "false", "off", "no", "closed", "close", "inactive"}:
            return False
    return bool(value)


def _compare(actual, operator, expected):
    try:
        if operator in {'eq', 'neq'}:
            if isinstance(actual, bool) or isinstance(expected, bool):
                actual = _normalize_bool(actual)
                expected = _normalize_bool(expected)
            result = actual == expected
            return not result if operator == 'neq' else result
        a, b = float(actual), float(expected)
        return {'gt': a > b, 'gte': a >= b, 'lt': a < b, 'lte': a <= b}.get(operator, False)
    except (TypeError, ValueError):
        return False


def _actions(config):
    actions = config.get('actions')
    if isinstance(actions, list):
        return [a for a in actions if isinstance(a, dict)]
    action = config.get('action')
    return [action] if isinstance(action, dict) else []


def _trigger_reading(trigger, readings):
    reading = (readings or {}).get(trigger.get('capability'))
    return reading.get('value') if isinstance(reading, dict) else None


def _trigger_matches(trigger, hardware_id_hex, readings):
    trigger_type = trigger.get('type', 'state')
    if trigger_type == 'schedule':
        return False
    if str(trigger.get('hardware_id_hex', '')).upper() != str(hardware_id_hex).upper():
        return False
    actual = _trigger_reading(trigger, readings)
    if actual is None:
        return False
    if trigger_type == 'state':
        return _compare(_normalize_bool(actual), trigger.get('operator', 'eq'), _normalize_bool(trigger.get('value')))
    return _compare(actual, trigger.get('operator', 'gt'), trigger.get('value'))


def _conditions_match(conditions, readings_by_device):
    for condition in conditions or []:
        if condition.get('type', 'reading') != 'reading':
            continue
        device_id = str(condition.get('hardware_id_hex', '')).upper()
        reading = (readings_by_device.get(device_id) or {}).get(condition.get('capability'))
        if not isinstance(reading, dict):
            return False
        if not _compare(reading.get('value'), condition.get('operator', 'eq'), condition.get('value')):
            return False
    return True


def _transition_key(automation_id, hardware_id_hex, capability):
    return (automation_id, str(hardware_id_hex).upper(), capability)


def _edge_allows(automation, trigger, hardware_id_hex, readings):
    """Only fire when a trigger changes from non-matching to matching."""
    current = _trigger_matches(trigger, hardware_id_hex, readings)
    key = _transition_key(automation['id'], hardware_id_hex, trigger.get('capability'))
    with _LOCK:
        previous = _LAST_MATCH.get(key, False)
        _LAST_MATCH[key] = current
    return current and not previous


def _local_hhmm():
    return datetime.datetime.now().strftime('%H:%M')


def _schedule_matches(trigger):
    if trigger.get('type') != 'schedule':
        return False
    target = str(trigger.get('time', '')).strip()
    return bool(target) and target == _local_hhmm()


def _schedule_slot(automation_id):
    return (automation_id, datetime.datetime.now().strftime('%Y-%m-%d %H:%M'))


def _schedule_allows(automation_id):
    key = _schedule_slot(automation_id)
    with _LOCK:
        if key in _LAST_SCHEDULE_SLOT:
            return False
        _LAST_SCHEDULE_SLOT[key] = True
        # Keep memory bounded while retaining enough recent slots for the scheduler.
        if len(_LAST_SCHEDULE_SLOT) > 500:
            oldest = next(iter(_LAST_SCHEDULE_SLOT))
            _LAST_SCHEDULE_SLOT.pop(oldest, None)
    return True


def execute_automation(automation, source='manual', user_id=None):
    config = automation.get('config') or {}
    actions = _actions(config)
    if not actions:
        return False, 'Automation has no actions'
    results = []
    failures = []
    for index, action in enumerate(actions, 1):
        target = str(action.get('hardware_id_hex', '')).upper()
        command = action.get('command', 'set_capability')
        data = action.get('data') or {}
        if not target:
            failures.append(f'Action {index}: no target')
            continue
        try:
            ok, response = send_device_command(target, {'command': command, 'data': data})
            if ok:
                results.append({'index': index, 'target': target, 'ok': True})
            else:
                error = response.get('error') if isinstance(response, dict) else str(response)
                failures.append(f'Action {index}: {error}')
        except Exception as error:
            failures.append(f'Action {index}: {error}')
    metadata = {
        'automation_id': automation['id'], 'source': source,
        'action_count': len(actions), 'success_count': len(results), 'failure_count': len(failures)
    }
    if failures:
        metadata['errors'] = failures
        add_activity('automation.error', f"Automation partially failed: {automation['name']}", user_id=user_id, metadata=metadata)
        if results:
            mark_triggered(automation['id'])
            return True, {'partial': True, 'errors': failures, 'results': results}
        return False, '; '.join(failures)
    mark_triggered(automation['id'])
    add_activity('automation.run', f"Automation ran: {automation['name']}", user_id=user_id, metadata=metadata)
    return True, {'results': results}


def _cooldown_allows(automation_id):
    now = time.monotonic()
    with _LOCK:
        last = _LAST_FIRED.get(automation_id, 0)
        if now - last < COOLDOWN_SECONDS:
            return False
        _LAST_FIRED[automation_id] = now
    return True


def _condition_devices(config, trigger_device=None):
    devices = {str(trigger_device).upper()} if trigger_device else set()
    for condition in config.get('conditions') or []:
        if condition.get('type', 'reading') == 'reading' and condition.get('hardware_id_hex'):
            devices.add(str(condition['hardware_id_hex']).upper())
    return devices


def evaluate_telemetry(hardware_id_hex, readings):
    for automation in list_automations():
        if not automation['enabled']:
            continue
        config = automation.get('config') or {}
        trigger = config.get('trigger') or {}
        if trigger.get('type') == 'schedule':
            continue
        if not _edge_allows(automation, trigger, hardware_id_hex, readings):
            continue
        condition_devices = _condition_devices(config, hardware_id_hex)
        readings_by_device = get_latest_readings_by_hardware_ids(condition_devices)
        # The current MQTT packet is authoritative for the triggering device.
        readings_by_device.setdefault(str(hardware_id_hex).upper(), {}).update(readings or {})
        if not _conditions_match(config.get('conditions'), readings_by_device):
            continue
        if not _cooldown_allows(automation['id']):
            continue
        execute_automation(automation, source='telemetry')


def evaluate_schedules():
    for automation in list_automations():
        if not automation['enabled']:
            continue
        config = automation.get('config') or {}
        trigger = config.get('trigger') or {}
        if not _schedule_matches(trigger):
            continue
        condition_devices = _condition_devices(config)
        readings_by_device = get_latest_readings_by_hardware_ids(condition_devices)
        if not _conditions_match(config.get('conditions'), readings_by_device):
            continue
        if not _schedule_allows(automation['id']):
            continue
        if not _cooldown_allows(automation['id']):
            continue
        execute_automation(automation, source='schedule')
