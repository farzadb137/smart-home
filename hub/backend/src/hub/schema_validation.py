"""Shared JSON-schema validation for hub (Option C).

Validates MQTT payloads and REST command payloads against
protocol/schemas/*.json (Option A single source).

- No import from config.py (avoids _require_env at import time).
- Missing jsonschema or missing schema files -> skip with (True, None)
  so dev machines without deps don't crash; CI installs jsonschema
  so validation is enforced there and in production.
- Collector drops invalid telemetry/status (never crashes, never writes DB).
- Commander rejects invalid device responses (treated as failure -> 504).
- REST validates outgoing command before sending (400 on bad shape).

Layout: this file is <repo>/hub/backend/src/hub/schema_validation.py
so REPO_ROOT is 4 levels up. Falls back to cwd search for tests.
"""
import json
from pathlib import Path

_SCHEMA_CACHE = {}


def _schema_dir():
    here = Path(__file__).resolve()
    # <repo> is 4 parents up from this file
    try:
        cand = here.parents[4] / "protocol" / "schemas"
        if cand.is_dir():
            return cand
    except Exception:
        pass
    # fallback: walk up from here looking for protocol/schemas
    for parent in here.parents:
        cand = parent / "protocol" / "schemas"
        if cand.is_dir():
            return cand
    # fallback: cwd (pytest from repo root)
    cand = Path.cwd() / "protocol" / "schemas"
    if cand.is_dir():
        return cand
    return cand


def _load_schema(name):
    if name in _SCHEMA_CACHE:
        return _SCHEMA_CACHE[name]
    path = _schema_dir() / name
    if not path.exists():
        _SCHEMA_CACHE[name] = None
        return None
    try:
        _SCHEMA_CACHE[name] = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[SCHEMA] Could not load {path}: {exc}")
        _SCHEMA_CACHE[name] = None
    return _SCHEMA_CACHE[name]


def _validate(payload, schema_name):
    schema = _load_schema(schema_name)
    if schema is None:
        return True, None  # schemas missing -> skip (dev only)
    try:
        import jsonschema
    except ImportError:
        return True, None  # dep missing -> skip (dev only)
    try:
        jsonschema.validate(payload, schema)
        return True, None
    except Exception as exc:
        # ValidationError message can be long; keep first line
        msg = str(exc).splitlines()[0][:300] if str(exc) else "schema mismatch"
        return False, msg


def validate_command(payload):
    """hub -> device. payload must be {"command": ..., "data"?: {...}}."""
    if not isinstance(payload, dict):
        return False, "command payload must be an object"
    return _validate(payload, "command.schema.json")


def validate_response(payload):
    """device -> hub. payload must be {"success": bool, ...}."""
    if not isinstance(payload, dict):
        return False, "response payload must be an object"
    return _validate(payload, "response.schema.json")


def validate_telemetry(payload):
    if not isinstance(payload, dict):
        return False, "telemetry payload must be an object"
    return _validate(payload, "telemetry.schema.json")


def validate_status(payload):
    if not isinstance(payload, dict):
        return False, "status payload must be an object"
    return _validate(payload, "status.schema.json")


def validate_time_sync(payload):
    if not isinstance(payload, dict):
        return False, "time-sync payload must be an object"
    return _validate(payload, "time-sync.schema.json")
