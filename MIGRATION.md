# Migrating an existing repo to this structure

Migration of `farzadb137/smart-home` is done in this tree. Delete this file after you have worked through the follow-ups.

## Steps
1. **Create a branch**: `git checkout -b restructure`
2. **Enable LFS first**: `git lfs install`, commit `.gitattributes`.
3. **Move with `git mv`** (keeps history), one area per commit:
   - Altium libraries -> `hardware/libraries/`
   - Each PCB project -> `hardware/boards/<board-id>/source/`
   - Old fab outputs -> `hardware/boards/<board-id>/releases/rev-X/`
   - Multi-board assemblies, enclosures -> `devices/<device-id>/`
   - Reusable firmware modules -> `firmware/components/<name>/`
   - Pin definitions -> `firmware/bsp/<board-id>/rev-X/`
   - Device firmware projects -> `firmware/apps/<device-id>/`
   - Hub Python -> `hub/backend/src/hub/...`, web files -> `hub/dashboard/`
4. **Fix Altium paths**: open each `.PrjPcb`, re-point library paths to `hardware/libraries/`
   (Project Options -> Search Paths / Libraries), save.
5. **Fix firmware paths**: update `EXTRA_COMPONENT_DIRS` in each app's `CMakeLists.txt`, build all.
6. **Remove secrets from git**: move them into `hub/secrets/` / `secrets.h`; if they were ever
   committed, rotate them (history still contains them).
7. **Fill in** `device.yaml` and board `README.md` "Used by" lists.
8. Delete example placeholders you don't need (`.gitkeep`, sample code).

## Mapping table
| Old path | New path | Note |
|----------|----------|------|
| `firmware/components/app_manager/` | `firmware/components/app_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/button_manager/` | `firmware/components/button_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/command_manager/` | `firmware/components/command_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/config_manager/` | `firmware/components/config_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/device_info/` | `firmware/components/device_info/` | sources -> src/, headers -> include/ |
| `firmware/components/ds18b20/` | `firmware/components/drivers/ds18b20/` | sources -> src/, headers -> include/ |
| `firmware/components/led_manager/` | `firmware/components/led_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/logger/` | `firmware/components/logger/` | sources -> src/, headers -> include/ |
| `firmware/components/mqtt_manager/` | `firmware/components/mqtt_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/ota_manager/` | `firmware/components/ota_manager/` | sources -> src/, headers -> include/, CMakelists.txt renamed |
| `firmware/components/provision_manager/` | `firmware/components/provision_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/sensor_manager/` | `firmware/components/sensor_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/status_manager/` | `firmware/components/status_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/system_info/` | `firmware/components/system_info/` | sources -> src/, headers -> include/ |
| `firmware/components/telemetry_buffer/` | `firmware/components/telemetry_buffer/` | sources -> src/, headers -> include/ |
| `firmware/components/telemetry_manager/` | `firmware/components/telemetry_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/time_manager/` | `firmware/components/time_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/topic_manager/` | `firmware/components/topic_manager/` | sources -> src/, headers -> include/ |
| `firmware/components/wifi_manager/` | `firmware/components/wifi_manager/` | sources -> src/, headers -> include/ |
| `firmware/nodes/temperature/` | `firmware/apps/smart-temp-sensor/` | EXTRA_COMPONENT_DIRS now also lists components/drivers; project name `temperature` unchanged; .vscode/ dropped |
| `firmware/nodes/switch/` | `firmware/apps/smart-switch/` | EXTRA_COMPONENT_DIRS now also lists components/drivers; project name `switch` unchanged; .vscode/ dropped |
| `firmware/nodes/door_sensor/` | `firmware/apps/smart-door-sensor/` | EXTRA_COMPONENT_DIRS now also lists components/drivers; project name `door_sensor` unchanged; .vscode/ dropped |
| `firmware/common/partitions_two_ota.csv` | `firmware/apps/*/partitions.csv` | copied into each app |
| `firmware/.vscode/, .vscode/` | `(dropped)` | machine-specific IDF path, git-ignored by skeleton |
| `hardware/libraries/*.IntLib` | `hardware/libraries/integrated/` | new sub-folder for compiled libraries |
| `hardware/boards/SmartTempSensor/` | `hardware/boards/smart-temp-sensor/source/` | generated Altium files (__Previews, *.PrjPcbStructure) not carried; they are git-ignored |
| `hardware/boards/SmartDoorSensor/` | `hardware/boards/smart-door-sensor/source/` | generated Altium files (__Previews, *.PrjPcbStructure) not carried; they are git-ignored |
| `hardware/boards/SmartMotionSensor/` | `hardware/boards/smart-motion-sensor/source/` | generated Altium files (__Previews, *.PrjPcbStructure) not carried; they are git-ignored |
| `hardware/boards/SmartSwitch/` | `hardware/boards/smart-switch/source/` | generated Altium files (__Previews, *.PrjPcbStructure) not carried; they are git-ignored |
| `hardware/boards/CompactESP/` | `hardware/boards/compact-esp/source/` | generated Altium files (__Previews, *.PrjPcbStructure) not carried; they are git-ignored |
| `(new)` | `devices/*` | one folder per product: smart-temp-sensor, smart-door-sensor, smart-switch, smart-motion-sensor, smart-hub |
| `hub/source/{api,config,mqtt_collector,hub_maintenance}.py, hub_app/, database/` | `hub/backend/src/hub/` | unchanged except 3 path edits (see below) |
| `hub/source/static/` | `hub/dashboard/` |  |
| `hub/other/set_password.py` | `hub/backend/scripts/set_password.py` | run with PYTHONPATH=hub/backend/src/hub |
| `hub/other/add_device.sh` | `tools/provisioning/add_device.sh` |  |
| `hub/other/publish_ota.sh` | `tools/release/publish_ota.sh` |  |
| `hub/source/service/*` | `hub/deploy/systemd/` | paths now /home/farzad/smart-hub/hub/backend/src/hub (repo cloned to ~/smart-hub, venv stays ~/smart-hub/.venv) |
| `hub/etc/mosquitto/conf.d/*, acl` | `hub/config/mosquitto/` |  |
| `hub/etc/*/certs/*.crt (public certs only)` | `hub/config/certs/` | no private keys were in the repo |
| `hub/etc/systemd/journald.conf.d/` | `hub/config/journald/` |  |
| `docs/architecture/firmware-architecture.md` | `docs/architecture/firmware-architecture.md` | unchanged |
| `docs/iot-linux-cheatsheet.md` | `docs/hub/linux-cheatsheet.md` |  |
| `docs/preview.webp, docs/Smart Home Dashboard.png` | `docs/images/` | png renamed to smart-home-dashboard.png |
| `docs/config.txt` | `(NOT carried)` | contains plaintext broker passwords - rotate them, see follow-ups |

## Follow-ups (not done automatically)
1. **Rotate the broker passwords.** `docs/config.txt` in the old repo contained `BROKER_PASSWORD` and `HUB_COMMANDER_PASSWORD` in plaintext; they remain in git history. Change them in Mosquitto and `/etc/smart-hub/secrets.env`.
2. **Altium library paths.** The `.PrjPcb` files point at `C:\Users\Farzad\Downloads\*.IntLib`. Re-point them to `hardware/libraries/integrated/`. `VIPER06HSTR.IntLib`, `PC814.IntLib` and `PESD3V3U1UA_115.IntLib` are used by SmartSwitch/CompactESP but are not in the repo yet.
3. **Board-local libraries** (`SmartTempSensor.PcbLib/.IntLib`, `SmartDoorSensor.PcbLib`, `SmartSwitch.PcbLib`) are still in each board's `source/` because the projects reference them by relative path; move them to `hardware/libraries/` from inside Altium.
4. **Hub database location.** Default is now `<repo>/hub/data/smart.db` (was `~/smart-hub/data/smart.db`). Move the existing DB, or set `DATABASE_PATH`. Same for uploaded OTA binaries (`FIRMWARE_DIR`).
5. **Git LFS.** Run `git lfs install` before the first commit (Altium files, PDFs, PNGs are LFS-tracked).
6. `hub_app` serves `setup.html` and `add-device.html`, which are not in `hub/dashboard/` (they were not in the old `static/` either).
