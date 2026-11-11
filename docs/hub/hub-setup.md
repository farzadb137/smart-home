# Hub Setup Guide

Bringing up the smart hub (Orange Pi or any Linux box) from zero.

## Prerequisites

- Orange Pi (or similar SBC) running a Debian-based Linux, SSH access enabled.
- Python 3.x: [TODO: minimum version]
- Network: hub and devices on the same LAN.

## 1. System packages

```bash
sudo apt update
sudo apt install -y mosquitto mosquitto-clients python3 python3-venv
```

## 2. Broker configuration

1. Copy the broker config into place:
   ```bash
   sudo cp hub/config/mosquitto/* /etc/mosquitto/conf.d/
   ```
2. Deploy ACLs (generated from the device registry — see provisioning doc): [TODO: command]
3. Restart the broker:
   ```bash
   sudo systemctl restart mosquitto
   ```
4. Smoke test: `mosquitto_sub -t 'home/#' -v` in one terminal, a test publish in another.

## 3. Backend

```bash
cd hub/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Secrets: copy `hub/secrets.example` and fill in real values — the file stays **outside git**.

Run: [TODO — entry point / service unit, e.g. `python -m hub` or systemd unit]

## 4. Database

[TODO: engine — SQLite/PostgreSQL; schema init command, e.g. alembic upgrade / init script; location of the DB file]

## 5. Dashboard

The dashboard (`hub/dashboard/`) is static HTML/CSS/JS served by the backend.
Open: `http://<hub-ip>:[TODO:port]/`

## 6. Devices

Provision devices so the hub accepts them — see [provisioning](../manufacturing/provisioning.md).

## 7. Deployment / updates

Redeploy the hub with the scripts in `hub/deploy/`: [TODO: exact command]

## Troubleshooting

| Symptom | Check |
|---|---|
| Devices can't connect | WiFi credentials, broker running, ACL entry for the device exists |
| Telemetry not stored | Backend running, DB writable, backend subscribed to `home/#` |
| Commands ignored | Backend publishing to the right `device_id`, device online (`status` topic) |
| Time wrong on devices | Backend publishing `home/time` periodically |