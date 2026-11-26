"""Protocol contract — Option A close-out (A5 final, 4/4).
Run from repo root:  python -m pytest tests/test_protocol_contract.py -v
Requires: pip install -r tools/codegen/requirements.txt
"""
import json
import pathlib
import re

import pytest

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

REPO = pathlib.Path(__file__).resolve().parents[1]
SCH = REPO / "protocol" / "schemas"
COMP_DIR = REPO / "firmware" / "components"


def load(name):
    return json.loads((SCH / name).read_text(encoding="utf-8"))


@pytest.mark.skipif(not HAS_JSONSCHEMA, reason="pip install jsonschema")
def test_telemetry_valid():
    schema = load("telemetry.schema.json")
    payload = {
        "device": {"id": 305419896, "name": "Living-Temp-01", "type": "temperature", "firmware": "0.5.1"},
        "system": {"uptime": 3600, "rssi": -65, "timestamp": 1760000000, "time_valid": True},
        "capabilities": {"temperature": {"value": 23.5, "valid": True}},
    }
    jsonschema.validate(payload, schema)
    # hex-string id must also validate (transition period, JS 2^53 safe)
    payload["device"]["id"] = "0123456789AB"
    jsonschema.validate(payload, schema)


@pytest.mark.skipif(not HAS_JSONSCHEMA, reason="pip install jsonschema")
def test_status_lwt_valid():
    schema = load("status.schema.json")
    jsonschema.validate({"id": 305419896, "online": False}, schema)
    jsonschema.validate({"id": "0123456789AB", "online": True, "uptime": 10, "rssi": -70}, schema)


@pytest.mark.skipif(not HAS_JSONSCHEMA, reason="pip install jsonschema")
def test_command_set_capability_and_negative():
    schema = load("command.schema.json")
    jsonschema.validate({"command": "set_capability", "data": {"name": "switch", "value": 1}}, schema)
    # missing value -> must FAIL
    with pytest.raises(Exception):
        jsonschema.validate({"command": "set_capability", "data": {"name": "switch"}}, schema)
    # bad sha256 -> must FAIL
    with pytest.raises(Exception):
        jsonschema.validate(
            {"command": "ota_update", "data": {"url": "https://x/fw.bin", "sha256": "zzz"}}, schema
        )


def test_no_hardcoded_topics():
    # Only topic_manager (firmware) and hub config.py may contain topic strings.
    # Everything else must use generated bindings (TOPIC_* / topics.h / topics.py).
    bad = []
    if not COMP_DIR.exists():
        pytest.skip(f"missing {COMP_DIR}")
    for p in COMP_DIR.rglob("*.c"):
        if "topic_manager" in str(p):
            continue
        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        if "home/devices" in txt or "home/time" in txt:
            bad.append(str(p.relative_to(REPO)))
    assert not bad, f"hardcoded topics outside topic_manager: {bad}"
