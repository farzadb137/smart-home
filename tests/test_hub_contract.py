"""Hub hardening contract — Option C (one-step close-out).
Run from repo root: python -m pytest tests/test_hub_contract.py -v
Requires: pip install -r hub/backend/requirements.txt -r tools/codegen/requirements.txt
No broker / DB / secrets needed (static checks + schema validation only).
"""
import json
import pathlib
import re
import sys

import pytest

REPO = pathlib.Path(__file__).resolve().parents[1]
HUB_SRC = REPO / "hub" / "backend" / "src" / "hub"
sys.path.insert(0, str(HUB_SRC))

try:
    import jsonschema  # noqa: F401
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

try:
    import schema_validation as sv
    HAS_SV = True
except Exception as exc:
    HAS_SV = False
    sv = None
    _SV_ERR = str(exc)


def test_requirements_pinned():
    req = REPO / "hub" / "backend" / "requirements.txt"
    assert req.exists(), f"missing {req}"
    txt = req.read_text(encoding="utf-8")
    # must pin runtime deps with ==
    for pkg in ["flask==", "paho-mqtt==", "jsonschema=="]:
        assert pkg in txt.lower(), f"requirements.txt must pin {pkg} (got: {txt!r})"
    # no bare unpinned lines for runtime deps
    for line in txt.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        # allow only pinned lines (contain ==) — bare 'flask' would fail
        assert "==" in s, f"unpinned requirement: {s!r} — pin with =="


def test_v1_routes_exist_and_legacy_kept():
    dev = (REPO / "hub" / "backend" / "src" / "hub" / "hub_app" / "devices.py").read_text(encoding="utf-8")
    init = (REPO / "hub" / "backend" / "src" / "hub" / "hub_app" / "__init__.py").read_text(encoding="utf-8")
    # legacy must still exist (keep for 1 release)
    for legacy in ['/api/devices', '/api/health']:
        holder = dev if "devices" in legacy else init
        assert legacy in holder, f"legacy route {legacy} lost — keep for 1 release"
    # v1 twins for all 6 device endpoints + health
    expected_v1 = [
        "/api/v1/devices",
        "/api/v1/devices/<hardware_id_hex>",
        "/api/v1/devices/<hardware_id_hex>/telemetry",
        "/api/v1/devices/<hardware_id_hex>/command",
        "/api/v1/devices/<hardware_id_hex>/rename",
        "/api/v1/devices/<hardware_id_hex>/history",
        "/api/v1/health",
    ]
    missing = [r for r in expected_v1 if r not in (dev + init)]
    assert not missing, f"missing v1 routes: {missing}"
    # validate_command must be wired in devices.py
    assert "validate_command" in dev, "devices.py must import/use validate_command"


def test_openapi_v1_parity():
    oa_path = REPO / "protocol" / "api" / "openapi.yaml"
    assert oa_path.exists(), "missing protocol/api/openapi.yaml (Option A)"
    txt = oa_path.read_text(encoding="utf-8")
    dev = (REPO / "hub" / "backend" / "src" / "hub" / "hub_app" / "devices.py").read_text(encoding="utf-8")
    init = (REPO / "hub" / "backend" / "src" / "hub" / "hub_app" / "__init__.py").read_text(encoding="utf-8")
    code = dev + init
    # every /api/v1/* path in openapi must exist in code
    paths = re.findall(r"/api/v1/[^\s:]*", txt)
    assert paths, "openapi has no /api/v1 paths"
    missing = [p.rstrip(":") for p in paths if p.rstrip(":") not in code and p.rstrip(":").replace("{hardwareId}", "<hardware_id_hex>") not in code]
    # normalize {hardwareId} -> <hardware_id_hex> for comparison
    norm_missing = []
    for p in paths:
        p = p.rstrip(":")
        norm = p.replace("{hardwareId}", "<hardware_id_hex>")
        if norm not in code and p not in code:
            norm_missing.append(p)
    assert not norm_missing, f"openapi paths without code: {norm_missing}"


@pytest.mark.skipif(not (HAS_JSONSCHEMA and HAS_SV), reason="need jsonschema + schema_validation")
def test_command_validation_good_and_bad():
    assert HAS_SV, f"schema_validation import failed: {_SV_ERR}"
    ok, _ = sv.validate_command({"command": "get_telemetry"})
    assert ok
    ok, _ = sv.validate_command({"command": "set_capability", "data": {"name": "switch", "value": 1}})
    assert ok
    ok, err = sv.validate_command({"command": "set_capability", "data": {"name": "switch"}})
    assert not ok, "missing value must fail"
    ok, err = sv.validate_command({"command": "ota_update", "data": {"url": "https://x/fw.bin", "sha256": "zzz"}})
    assert not ok, f"bad sha256 must fail (got ok, schemas loaded? {sv._load_schema('command.schema.json') is not None})"
    ok, _ = sv.validate_command({"command": "nope"})
    assert not ok, "unknown command must fail"


@pytest.mark.skipif(not (HAS_JSONSCHEMA and HAS_SV), reason="need jsonschema + schema_validation")
def test_response_validation_good_and_bad():
    assert HAS_SV
    ok, _ = sv.validate_response({"success": True, "data": {"name": "switch", "value": 1}})
    assert ok
    ok, _ = sv.validate_response({"success": False, "error": "Unknown capability"})
    assert ok
    ok, _ = sv.validate_response({"error": "missing success"})
    assert not ok
    ok, _ = sv.validate_response({"success": "yes"})
    assert not ok, "success must be boolean"
    ok, _ = sv.validate_response("not-a-dict")
    assert not ok


@pytest.mark.skipif(not (HAS_JSONSCHEMA and HAS_SV), reason="need jsonschema + schema_validation")
def test_telemetry_status_validation():
    assert HAS_SV
    good_tel = {
        "device": {"id": 305419896, "name": "Living-Temp-01", "type": "temperature", "firmware": "0.5.1"},
        "system": {"uptime": 3600, "rssi": -65, "timestamp": 1760000000, "time_valid": True},
        "capabilities": {"temperature": {"value": 23.5, "valid": True}},
    }
    ok, _ = sv.validate_telemetry(good_tel)
    assert ok
    bad_tel = {"device": {}, "system": {}, "capabilities": {}}
    ok, _ = sv.validate_telemetry(bad_tel)
    assert not ok, "empty telemetry must fail"
    ok, _ = sv.validate_status({"id": 305419896, "online": False})
    assert ok
    ok, _ = sv.validate_status({"id": 305419896})
    assert not ok, "missing online must fail"


def test_commander_validates_response():
    cmd = (REPO / "hub" / "backend" / "src" / "hub" / "hub_app" / "mqtt_commander.py").read_text(encoding="utf-8")
    assert "validate_response" in cmd, "mqtt_commander.py must import/use validate_response"
    assert "Invalid device response" in cmd, "commander must reject invalid responses"
    # must handle non-JSON without crashing
    assert "JSONDecodeError" in cmd or "json.loads" in cmd
    # timeout behavior kept
    assert "Device did not respond in time" in cmd


def test_collector_validates_and_drops():
    col = (REPO / "hub" / "backend" / "src" / "hub" / "mqtt_collector.py").read_text(encoding="utf-8")
    assert "validate_telemetry" in col and "validate_status" in col, "collector must import both validators"
    assert "Invalid telemetry schema, dropping" in col, "telemetry must drop invalid"
    assert "Invalid status schema, dropping" in col, "status must drop invalid"
    # drop must happen BEFORE any DB write (get_or_create_device/save)
    for fn, guard in [("handle_telemetry", "validate_telemetry"), ("handle_status", "validate_status")]:
        m = re.search(rf"def {fn}\(.*?\):(.*?)(?=\ndef |\Z)", col, re.S)
        assert m, f"missing {fn}"
        body = m.group(1)
        assert guard in body, f"{fn} missing {guard}"
        assert body.index(guard) < body.index("get_or_create_device"), f"{fn}: validation must precede DB write"
