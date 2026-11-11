# Orange Pi / Linux Cheatsheet

Everyday commands for maintaining the hub. Assumes a Debian-based system.

## System

```bash
# Disk, memory, temperature
df -h && free -h
cat /sys/class/thermal/thermal_zone0/temp   # millidegrees C

# Services
systemctl status mosquitto
sudo systemctl restart mosquitto
sudo systemctl enable --now <hub-service>    # backend autostart

# Logs
journalctl -u mosquitto -f
journalctl -u <hub-service> -f --since today
```

## Networking

```bash
ip a                          # find hub IP
ip r                          # default route
ping <device-ip>
nmcli device wifi list        # WiFi (if used)
```

## MQTT (mosquitto-clients)

```bash
# Watch all home traffic
mosquitto_sub -h localhost -t 'home/#' -v

# Watch one device
mosquitto_sub -h localhost -t 'home/devices/DEV_ID/#' -v

# Send a test command
mosquitto_pub -h localhost -t 'home/devices/DEV_ID/command' \
  -m '{"cmd":"ping"}'

# Check retained status
mosquitto_sub -h localhost -t 'home/devices/DEV_ID/status' -C 1
```

## Python venv

```bash
source hub/backend/.venv/bin/activate
deactivate
```

## Files worth knowing

| Path | What |
|---|---|
| `/etc/mosquitto/conf.d/` | broker config + ACLs |
| `/var/log/mosquitto/` | broker logs |
| repo `hub/` | backend, dashboard, deploy scripts |

## Git on the hub

```bash
git pull --ff-only            # safe update
git log --oneline -5
git status                    # never commit secrets
```

## Backups

[TODO: what to back up — DB file/dump, hub/config; where; schedule]