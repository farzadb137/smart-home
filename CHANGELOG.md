# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- Protocol source of truth: schemas/, openapi.yaml, generated topics.h/py, contract tests
- BSP extracted for temp/switch/door, pins single-source
- button_manager_init(gpio), led_manager_init(gpio,count) from BSP

### Added
- `hub/backend/src/hub/schema_validation.py`: shared validators for
  `command/response/telemetry/status/time-sync` against `protocol/schemas/*.json`.
  Skips gracefully if `jsonschema` or schemas missing (dev), enforces in CI/prod.
- `hub/backend/src/hub/hub_app/devices.py`: dual routes — every `/api/*`
  now also serves `/api/v1/*` per `protocol/api/openapi.yaml`.
  Legacy `/api/*` kept for 1 release. Outgoing `command` payloads validated
  (400 on bad shape) before MQTT publish.
- `hub/backend/src/hub/hub_app/__init__.py`: `/api/v1/health` alongside `/api/health`.
- `tests/test_hub_contract.py`: 8 tests (pinned deps, v1 routes + legacy,
  openapi parity, command/response/telemetry/status validation,
  commander + collector guards).

### Changed
- `hub/backend/requirements.txt`: pinned `flask==3.1.0`, `paho-mqtt==2.1.0`,
  `jsonschema==4.23.0`. Regenerate from Pi venv on upgrade
  (`pip freeze | grep -Ei 'flask|paho|jsonschema'`).
- `hub/backend/src/hub/hub_app/mqtt_commander.py`: device `response`
  validated against `response.schema.json`. Non-JSON or schema-invalid
  -> `False, {"error": "Invalid device response: ..."}` ( surfaces as 504 ).
  Timeout behavior unchanged.
- `hub/backend/src/hub/mqtt_collector.py`: `handle_telemetry/handle_status`
  validate against schemas first; invalid -> log + drop, never DB write,
  never crash (fail-closed on bad payloads).
- `.github/workflows/hub.yml`: runs all 4 contract suites
  (`protocol + hub + bsp + bsp_full`) + `generate --check` + `compileall`.

### Rule
- REST shapes follow `protocol/api/openapi.yaml`; MQTT payloads follow
  `protocol/schemas/*.json`. Change schemas first, then code.
- Keep legacy `/api/*` until mobile/dashboard moved to `/api/v1/*`, then remove in one release.
