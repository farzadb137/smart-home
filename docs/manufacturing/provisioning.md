# Provisioning & Manufacturing

How a board becomes a **known device** the hub accepts, and how to keep per-unit secrets out of git.

## Concepts

- **device_id** — stable, unique identity of a unit; used in every MQTT topic (`home/devices/{device_id}/...`) and in hub ACLs. Never reused.
- **Credentials** — per-device WiFi + MQTT credentials. Generated per unit, written to the device, stored in the hub config. **Never committed** — only `*.example` templates live in the repo.

## Flow

```
fabricated board (rev-X)
        │  flash firmware app (idf.py flash)
        ▼
provision: write device_id + WiFi + MQTT credentials
        │
        ▼
register on hub: ACL entry + device registry entry
        │
        ▼
verify: device publishes status → hub shows it online
```

## Steps

### 1. Flash firmware
```bash
cd firmware/apps/<app>
idf.py -p <port> flash monitor
```

### 2. Provision identity
Tool: [TODO — the provisioning script in `tools/` or `hub/deploy/`; name + usage]
Writes to NVS (or efuse): `device_id`, WiFi SSID/password, MQTT username/password, hub address.

### 3. Register on the hub
1. Add an ACL entry in `hub/config/mosquitto/acl` for the device's subtree (or regenerate ACLs from the device registry: [TODO command]).
2. Add the device to the backend registry / DB: [TODO command].
3. Restart/apply broker config.

### 4. Verify
```bash
mosquitto_sub -h localhost -t 'home/devices/<device_id>/status' -C 1
```
Device should appear online; dashboard shows it.

## Labeling

Each unit gets a physical label: product name, `device_id`, hardware revision, MAC. [TODO: label format / QR if planned]

## Rules

- Provisioning secrets are written to the device once; log files and shell history must not capture them (avoid secrets on the command line; use prompt/env).
- Records of which `device_id` went to which unit/home are kept **outside the repo**.
- A device may be re-provisioned; a `device_id` may not be re-assigned to different hardware.