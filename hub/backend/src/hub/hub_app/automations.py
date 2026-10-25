from flask import Blueprint, jsonify, request, session
from database import add_activity, create_automation, delete_automation, get_automation, list_automations, update_automation
from hub_app.auth import login_required
from hub_app.automation_engine import execute_automation

bp = Blueprint('automations', __name__)


def _validate(payload):
    name = (payload.get('name') or '').strip()
    config = payload.get('config') or {}
    trigger = config.get('trigger') or {}
    actions = config.get('actions')
    if not isinstance(actions, list):
        legacy = config.get('action')
        actions = [legacy] if isinstance(legacy, dict) else []
    if not name or len(name) > 80:
        return None, 'Name is required and must be 80 characters or fewer'
    trigger_type = trigger.get('type', 'state')
    if trigger_type not in {'state', 'numeric', 'schedule'}:
        return None, 'Unsupported trigger type'
    if trigger_type == 'schedule':
        import re
        if not re.fullmatch(r'(?:[01]\\d|2[0-3]):[0-5]\\d', str(trigger.get('time', ''))):
            return None, 'Schedule time must use HH:MM'
    else:
        if not trigger.get('hardware_id_hex') or not trigger.get('capability'):
            return None, 'Trigger device and capability are required'
        if trigger.get('operator', 'eq') not in {'eq', 'neq', 'gt', 'gte', 'lt', 'lte'}:
            return None, 'Unsupported trigger operator'
        if 'value' not in trigger:
            return None, 'Trigger value is required'
    if not actions:
        return None, 'At least one action is required'
    for action in actions:
        if not isinstance(action, dict) or not action.get('hardware_id_hex') or not action.get('command'):
            return None, 'Each action needs a device and command'
    conditions = config.get('conditions') or []
    if not isinstance(conditions, list):
        return None, 'Conditions must be a list'
    for condition in conditions:
        if condition.get('type', 'reading') != 'reading' or not condition.get('hardware_id_hex') or not condition.get('capability'):
            return None, 'Each condition needs a device and capability'
        if condition.get('operator', 'eq') not in {'eq', 'neq', 'gt', 'gte', 'lt', 'lte'} or 'value' not in condition:
            return None, 'Each condition needs an operator and value'
    normalized = dict(config)
    normalized['actions'] = actions
    normalized.pop('action', None)
    normalized['conditions'] = conditions
    return {'name': name, 'config': normalized, 'enabled': bool(payload.get('enabled', True))}, None


@bp.route('/api/automations')
@login_required
def get_automations():
    return jsonify(list_automations())


@bp.route('/api/automations', methods=['POST'])
@login_required
def post_automation():
    payload = request.get_json(silent=True) or {}
    data, error = _validate(payload)
    if error:
        return jsonify({'error': error}), 400
    automation = create_automation(data['name'], data['config'], data['enabled'])
    add_activity('automation.create', f"Created automation: {data['name']}", user_id=session.get('user_id'), metadata={'automation_id': automation['id']})
    return jsonify(automation), 201


@bp.route('/api/automations/<int:automation_id>', methods=['PUT'])
@login_required
def put_automation(automation_id):
    if get_automation(automation_id) is None:
        return jsonify({'error': 'Automation not found'}), 404
    payload = request.get_json(silent=True) or {}
    data, error = _validate(payload)
    if error:
        return jsonify({'error': error}), 400
    automation = update_automation(automation_id, data['name'], data['config'], data['enabled'])
    add_activity('automation.update', f"Updated automation: {data['name']}", user_id=session.get('user_id'), metadata={'automation_id': automation_id})
    return jsonify(automation)


@bp.route('/api/automations/<int:automation_id>', methods=['DELETE'])
@login_required
def remove_automation(automation_id):
    automation = get_automation(automation_id)
    if automation is None:
        return jsonify({'error': 'Automation not found'}), 404
    delete_automation(automation_id)
    add_activity('automation.delete', f"Deleted automation: {automation['name']}", user_id=session.get('user_id'), metadata={'automation_id': automation_id})
    return jsonify({'success': True})


@bp.route('/api/automations/<int:automation_id>/run', methods=['POST'])
@login_required
def run_automation(automation_id):
    automation = get_automation(automation_id)
    if automation is None:
        return jsonify({'error': 'Automation not found'}), 404
    ok, detail = execute_automation(automation, source='manual', user_id=session.get('user_id'))
    if not ok:
        return jsonify({'error': detail or 'Automation failed'}), 400
    return jsonify({'success': True, 'partial': bool(isinstance(detail, dict) and detail.get('partial')), 'detail': detail, 'automation': get_automation(automation_id)})
