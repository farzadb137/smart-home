# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- Protocol source of truth: schemas/, openapi.yaml, generated topics.h/py, contract tests
- BSP extracted for temp/switch/door, pins single-source
- button_manager_init(gpio), led_manager_init(gpio,count) from BSP

### Added
- `protocol/schemas/`: telemetry, status, command, response, time-sync JSON schemas (draft v1, backward compatible).
  Device id accepts int OR 12/16-char hex string (transition period for JS 2^53).
- `protocol/api/openapi.yaml`: versioned REST `/api/v1/*` mirroring current Flask `/api/*` (health, devices, telemetry, history, command, rename). Keep legacy `/api/*` for 1 release.
- `protocol/generated/topics.h` + `topics.py`: now emit `TOPIC_*` + `TOPIC_*_QOS` + `TOPIC_*_RETAINED` from `mqtt-topics.yaml`.
- `tools/codegen/requirements.txt`: `pyyaml>=6.0`, `jsonschema>=4.0`, `pytest>=7.0`.
- `tests/test_protocol_contract.py`: 4 tests (telemetry valid incl. hex id, status LWT, command + negative, no hardcoded topics).

### Changed
- `protocol/mqtt-topics.yaml`: topic STRINGS unchanged. Only added `qos/retained/timeout_sec/interval_sec/schema/lwt` + rules block observed from code.
- `tools/codegen/generate.py`: supports `--check` for CI, includes schema path comments, fail-fast.
- `firmware/components/topic_manager/src/topic_manager.c`: uses `topics.h` (`TOPIC_TELEMETRY/STATUS/COMMAND/RESPONSE/TIME`), no hardcoded strings.
- `hub/backend/src/hub/config.py`: single source — loads `protocol/generated/topics.py`, exposes `TELEMETRY_TOPIC/STATUS_TOPIC/RESPONSE_SUB/CHILD_*/TIME_SYNC_TOPIC` via `_sub()` (+→wildcard) + `format_command_topic()`. `mqtt_collector.py` + `hub_app/mqtt_commander.py` import from config.
- `.github/workflows/hub.yml`: gate — install both requirements, `python tools/codegen/generate.py`, `git diff --exit-code protocol/generated/`, `pytest tests/test_protocol_contract.py -v`.

### Rule
- Edit ONLY `protocol/mqtt-topics.yaml`, then re-run `python tools/codegen/generate.py`. Never edit `protocol/generated/` by hand.
