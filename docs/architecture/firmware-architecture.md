# Firmware Architecture

## Layering

```
firmware/
├── components/   # reusable, device-agnostic ESP-IDF components
├── bsp/          # board support packages: pin maps, drivers, per-board init
├── apps/         # one ESP-IDF project per product, thin glue layer
└── scripts/      # build/flash helper scripts
```

**Dependency rule:** `apps → bsp → components`. Apps never talk to raw peripherals directly, and components never depend on an app. A BSP may depend only on components; an app may select one BSP.

## Responsibilities

| Layer | Owns | Never does |
|---|---|---|
| `components/` | MQTT client wrapper, telemetry encoder, OTA, storage, sensors/generic drivers | pin numbers, product behavior |
| `bsp/` | Pin map, GPIO init, board-specific drivers, power config | MQTT logic, product behavior |
| `apps/` | Product behavior: which components, which sensors, event handling, defaults | reimplementing components |

## Conventions

- Components and folders: `snake_case` (ESP-IDF standard). Product folders elsewhere in the repo: `kebab-case`.
- Every component ships with a `README.md` and a `CMakeLists.txt` with proper `REQUIRES`/`PRIV_REQUIRES`.
- Configuration only via `sdkconfig.defaults` per app plus Kconfig options — no compile-time hacks.
- FreeRTOS style: tasks own queues; use event groups for lifecycle; avoid shared globals without a mutex.
- MQTT topics always come from the generated protocol bindings (`protocol/generated/`), never as string literals.

## Child devices

Apps that bridge to child nodes (e.g. wired sensors behind one ESP32) publish under
`home/devices/{device_id}/children/{child_id}/...` — the parent app owns the MQTT connection and serializes child traffic.

## Build & CI

- Local build: `idf.py set-target esp32c6 && idf.py build` inside an app folder. [TODO: adjust if targets differ per app]
- CI (`.github/workflows/firmware.yml`) builds all apps on push. Keep every app green.

## Adding a new device app

1. Copy the closest existing app in `firmware/apps/`.
2. Create/reuse a BSP for the board it runs on.
3. Wire behavior only in the app layer.
4. Register the product in `devices/<device>/device.yaml`.
5. Update `docs/index.md` and the firmware docs if a new pattern appears.