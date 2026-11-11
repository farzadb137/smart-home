# Firmware Coding Standard (ESP-IDF / FreeRTOS)

Applies to everything under `firmware/`. CI builds must stay green; style is enforced by review.

## Language & format

- C (per ESP-IDF conventions) unless a component states otherwise.
- Format with `clang-format` using the ESP-IDF style. [TODO: add a `.clang-format` at repo root]
- Files: UTF-8, no tabs, 4 spaces, max ~100 columns.
- Every file starts with a short SPDX/license header.

## Naming

| Thing | Style | Example |
|---|---|---|
| component / folder | `snake_case` | `mqtt_link` |
| functions | `component_verb_object` | `telemetry_send_status()` |
| static functions | plain | `parse_payload()` |
| types | `snake_case_t` | `telemetry_msg_t` |
| macros / constants | `UPPER_SNAKE` | `TELEMETRY_PERIOD_MS` |
| FreeRTOS objects | suffix | `s_state_queue`, `s_wifi_event_group` |

## Structure rules

- **Layering:** `apps → bsp → components`; never skip a layer (see firmware architecture doc).
- No pin numbers, WiFi SSIDs, or topic strings in components — those belong to BSPs, config, or generated protocol bindings.
- No `malloc` in steady-state loops; pre-allocate queues/buffers at init.
- Every `xQueueSend`/`xEventGroupWaitBits` uses an explicit timeout; no infinite waits in data paths.
- Errors: return `esp_err_t` in components; log with `ESP_LOGx` tags matching the module name.
- Public API of each component is declared in its main header, documented with Doxygen comments.

## FreeRTOS style

- One task per clear responsibility; tasks block on queues — never busy-wait.
- Priorities documented next to `xTaskCreate`; avoid >4 app-level priorities.
- ISR: only `...FromISR` APIs; defer work to a task.

## MQTT / protocol

- Topics only from `protocol/generated/` bindings — a hardcoded topic string is a review blocker.
- JSON payloads validated against the schema in `protocol/` (encoder/decoder helpers, not hand-rolled parsing where possible).

## Review checklist

- [ ] Builds clean with no new warnings
- [ ] Layering respected
- [ ] No secrets, no hardcoded topics/pins in components
- [ ] Timeouts on all blocking calls
- [ ] Logs use proper tags and levels (no log spam at INFO)
- [ ] README/Kconfig updated for component changes
- [ ] `CHANGELOG.md` entry for user-visible changes