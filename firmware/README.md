# Firmware (ESP-IDF)

- `components/` – reusable ESP-IDF components, hardware-agnostic
- `bsp/` – board support per board revision (pins, init). Names mirror `hardware/boards/`
- `apps/` – one ESP-IDF project per device firmware
- `scripts/` – helpers

Apps pull components in via `EXTRA_COMPONENT_DIRS` in their top-level `CMakeLists.txt`.

```bash
cd firmware/apps/smart-temp-sensor
idf.py set-target esp32c6
idf.py build flash monitor
```
