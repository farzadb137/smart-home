# Test Plan

## Levels

| Level | Scope | Where |
|---|---|---|
| Unit | Firmware components (host-side mocks), Python backend modules | `firmware/components/*/test`, `hub/backend/tests` |
| Integration | Backend ↔ broker ↔ DB ↔ API; dashboard against a stub broker | `tests/` |
| Hardware-in-the-loop (HIL) | Real device + real hub over MQTT, on the bench | `tests/hil` |
| Field | Full system in the actual home for a soak period | manual |

## CI (automated)

- `firmware.yml` — builds every ESP-IDF app; must pass before merge.
- `hub.yml` — backend lint + unit tests; must pass before merge.
- Protocol change rule: a PR touching `protocol/` must update firmware + hub + schema in the same PR, or CI-level contract tests will fail. [TODO: add contract test once bindings generator exists]

## Integration tests

- **Broker ACL:** device A cannot publish to device B's topics (test with mosquitto clients using per-device credentials).
- **Telemetry storage:** publish a valid telemetry message → row appears in DB with correct values.
- **Command round-trip:** API command → `command` topic → fake device responds → API reports success.
- **Retained status:** fresh subscriber receives last status immediately.
- **Time sync:** subscriber on `home/time` receives periodic broadcasts.

## HIL tests (bench, per release)

For each device, scripted: flash, power-cycle, verify:
- [ ] Connects to WiFi and broker within N seconds
- [ ] Publishes retained status
- [ ] Telemetry values sane against a reference sensor
- [ ] Responds to command within latency budget
- [ ] Survives 24 h soak with no reconnect storm

## Field / release gates

A release (`<device>/vX.Y.Z`, `hub/vX.Y.Z`) requires:
1. All CI green.
2. HIL checklist done for every affected device.
3. `CHANGELOG.md` updated.
4. No open critical bugs for the component.

## Known gaps

[TODO — track: no automated HIL runner yet; dashboard has no e2e tests; fuzzing of payload parsing not done.]