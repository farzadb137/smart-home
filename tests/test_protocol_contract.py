"""Contract test skeleton (hub CI). Validates live payloads against schemas/.
Run: pip install jsonschema paho-mqtt; pytest tests/test_protocol_contract.py
Does NOT need hardware: uses example payloads + optional live broker.
"""
import json, pathlib
import pytest

try:
    import jsonschema
    HAS = True
except ImportError:
    HAS = False

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCH = ROOT / "option-a-protocol" / "schemas"

def load(name):
    return json.loads((SCH / name).read_text())

@pytest.mark.skipif(not HAS, reason="pip install jsonschema")
def test_telemetry_example_valid():
    schema = load("telemetry.schema.json")
    payload = {
        "device": {"id": 305419896, "name": "Living-Temp-01", "type": "temperature", "firmware": "0.5.1"},
        "system": {"uptime": 3600, "rssi": -65, "timestamp": 1760000000, "time_valid": True},
        "capabilities": {"temperature": {"value": 23.5, "valid": True}},
    }
    jsonschema.validate(payload, schema)

@pytest.mark.skipif(not HAS, reason="pip install jsonschema")
def test_status_lwt_valid():
    schema = load("status.schema.json")
    jsonschema.validate({"id": 305419896, "online": False}, schema)

@pytest.mark.skipif(not HAS, reason="pip install jsonschema")
def test_command_set_capability():
    schema = load("command.schema.json")
    jsonschema.validate({"command": "set_capability", "data": {"name": "relay", "value": 1}}, schema)
    with pytest.raises(Exception):
        jsonschema.validate({"command": "set_capability", "data": {"name": "relay"}}, schema)

def test_no_hardcoded_topics_in_components():
    # Guard for §6.2 + §14.1: only topic_manager may contain home/devices
    repo = pathlib.Path("smart-home-audit/firmware/components")
    bad = []
    for p in repo.rglob("*.c"):
        if "topic_manager" in str(p):
            continue
        if "home/devices" in p.read_text(errors="ignore"):
            bad.append(str(p))
    assert not bad, f"hardcoded topics outside topic_manager: {bad}"
