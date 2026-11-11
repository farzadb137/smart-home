# System Architecture Overview

## Big picture

A **local-first** smart home: everything runs inside the home LAN, no mandatory cloud dependency.

```
┌─────────────┐  MQTT   ┌──────────────────────────────┐
│ ESP32-C6    │◄───────►│  Orange Pi (hub, Linux)      │
│ devices     │  WiFi   │  ┌────────────────────────┐  │
│ (sensors,   │         │  │ Mosquitto MQTT broker  │  │
│  switches)  │         │  ├────────────────────────┤  │
└─────────────┘         │  │ Python backend         │  │
                        │  │  - device registry     │  │
┌─────────────┐         │  │  - telemetry store (DB)│  │
│ Child nodes │◄─bus───►│  │  - REST API            │  │
│ (via parent │         │  ├────────────────────────┤  │
│  device)    │         │  │ Web dashboard (HTML/   │  │
└─────────────┘         │  │  CSS/JS)               │  │
                        │  └────────────────────────┘  │
                        └──────────────────────────────┘
```

## Components

### Devices (ESP32-C6, ESP-IDF / FreeRTOS)
- Firmware built from `firmware/`: reusable `components/`, per-board `bsp/`, one app per product in `firmware/apps/`.
- Each product is described by a `device.yaml` recipe in `devices/<device>/`.
- Devices connect over WiFi and speak MQTT only — they hold no business logic beyond sensing/actuation and safe defaults.
- Devices may host **child nodes** (sub-topics `children/{child_id}/...`), so one radio can serve multiple sensing points.

### Hub (Orange Pi, Linux)
- **Mosquitto** as the MQTT broker, ACLs per device (see `hub/config/mosquitto/`).
- **Python backend** (`hub/backend/`): subscribes to telemetry/status, persists to the database, exposes a REST API, publishes commands.
- **Dashboard** (`hub/dashboard/`): static HTML/CSS/JS served by the backend.
- Deployment and provisioning scripts in `hub/deploy/`.

### Protocol
- Topic scheme and direction rules: `protocol/mqtt-topics.yaml` (single source of truth).
- Payload schemas in `protocol/`; generated bindings land in `protocol/generated/`.

## Data flow

1. Device publishes telemetry/status to `home/devices/{device_id}/telemetry|status`.
2. Hub backend subscribes, validates against schema, stores in DB.
3. Dashboard reads via REST API (or websocket if enabled).
4. User actions become commands: backend publishes `home/devices/{device_id}/command`; device replies on `.../response`.
5. Hub publishes time sync on `home/time` so devices stay clock-aligned without NTP.

## Design principles

- **Local first** — full functionality without internet; remote access is an optional add-on.
- **Modular** — firmware components, BSPs and apps are layered; hub services are independently replaceable.
- **Scalable** — flat MQTT topic scheme; adding a device is a config entry, not a hub change.
- **Security progressively** — per-device MQTT ACLs now, TLS/certificates as it matures.

## Status

[TODO — update as components land: which parts exist, which are stubs.]