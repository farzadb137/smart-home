# Protocol Overview

The single source of truth for the wire protocol is [`protocol/mqtt-topics.yaml`](../../protocol/mqtt-topics.yaml) (payload schemas live beside it; generated bindings in `protocol/generated/`). **This document summarizes — never override it from memory.**

## Transport

- MQTT 3.1.1/5 over WiFi to the hub broker (Mosquitto). Default broker port: [TODO: 1883 / 8883].
- QoS: telemetry `0–1`, commands `1` (at least once), device must respond on the response topic.
- Retained: `status` topics are retained so late-joining consumers see current state; telemetry is not.

## Topic scheme (prefix `home`)

| Topic | Direction | Purpose |
|---|---|---|
| `home/devices/{device_id}/telemetry` | device → hub | periodic sensor readings |
| `home/devices/{device_id}/status` | device → hub | online/offline, health, uptime (retained) |
| `home/devices/{device_id}/response` | device → hub | reply to a command |
| `home/devices/{device_id}/command` | hub → device | actuation / config commands |
| `home/devices/{device_id}/children/{child_id}/telemetry` | device → hub | child-node readings behind a parent device |
| `home/devices/{device_id}/children/{child_id}/status` | device → hub | child-node state |
| `home/devices/{device_id}/children/{child_id}/command` | hub → device | command routed to a child via its parent |
| `home/devices/{device_id}/children/{child_id}/response` | device → hub | child response |
| `home/time` | hub → all devices | time sync broadcast |

## Rules

1. `{device_id}` is the stable device identity assigned at provisioning — never reuse it.
2. Topics are **case-sensitive** and must not be constructed ad hoc; use the generated bindings.
3. Every device may only publish/subscribe to its own subtree — enforced by Mosquitto ACLs (`hub/config/mosquitto/acl`).
4. Backward compatibility: adding fields to a payload is a minor change; removing/renaming fields requires a schema version bump and a migration note in `CHANGELOG.md`.
5. The REST API (hub ↔ dashboard) is documented in `protocol/` as well — it is part of the protocol contract. [TODO: add `rest-api.yaml`]

## Payload conventions

- Encoding: JSON (UTF-8) unless a schema says otherwise.
- Timestamps: Unix epoch seconds (device time comes from `home/time` sync).
- Every telemetry message carries `device_id`, `ts`, and the measurement fields defined in the device's schema.

## Change process

1. Edit `protocol/mqtt-topics.yaml` / the schema file.
2. Regenerate bindings into `protocol/generated/`.
3. Update firmware and hub consumers in the same PR (protocol is a contract — atomic change).
4. Record breaking changes in `CHANGELOG.md` and, if architectural, as an ADR.