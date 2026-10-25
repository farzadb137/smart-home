# Smart Home IoT System

## Goal

Build a scalable local-first smart home IoT platform.

## Architecture

ESP32 devices communicate with an Orange Pi hub using MQTT.

## Devices

Currently planned:

- Temperature sensor node
- Smart switch node

## Main Technologies

- ESP-IDF
- FreeRTOS
- MQTT
- Orange Pi / Linux
- Python backend
- Web dashboard

## Design Philosophy

- Local first
- Modular architecture
- Scalable to many devices
- Security improvements added progressively

---

Monorepo for all devices (smart hub, sensors, bridges), their hardware, firmware, hub software, mobile apps and documentation.

## Repository map

| Folder        | Contents |
|---------------|----------|
| `devices/`    | Products. Each device is a recipe: which boards + which firmware/software (`device.yaml`) |
| `hardware/`   | Altium libraries, templates and **reusable boards** (one folder per board) |
| `firmware/`   | ESP-IDF reusable components, board support packages (BSP) and per-device apps |
| `hub/`        | Smart hub software: Python backend (broker, DB, API), web dashboard, config, deploy |
| `mobile/`     | Android / iOS apps (planned) |
| `protocol/`   | Single source of truth: MQTT topics, payload schemas, REST API spec |
| `docs/`       | Architecture, decisions (ADRs), processes, guides |
| `tools/`      | Code generation, provisioning, release scripts |
| `tests/`      | Integration and hardware-in-the-loop tests |

Start reading at [`docs/index.md`](docs/index.md).

## Conventions
- Folders: `kebab-case`. ESP-IDF components: `snake_case`.
- Board revisions: `rev-A`, `rev-B` ... Files in `hardware/boards/*/releases/` are **frozen** after fabrication.
- Tags: `<device>/vX.Y.Z`, `hub/vX.Y.Z`, `board/<board>/rev-X`.
- Secrets are never committed. Use the `*.example` templates.
