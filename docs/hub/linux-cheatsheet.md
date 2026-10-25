# IoT Hub — Linux Command Cheatsheet

Commands used while building and troubleshooting the Orange Pi hub (mosquitto, iot-collector, iot-api). Organized by task, not chronology.

---

## Power

```bash
sudo reboot                 # restart the Pi
sudo shutdown now           # power off immediately
sudo shutdown -r +5         # reboot in 5 minutes
sudo shutdown -c            # cancel a pending shutdown
```

**Why reboot testing matters for this project:** `systemctl start` on a warm system doesn't prove your service *ordering* (`After=`/`Wants=`) actually holds at cold boot. Always validate service changes with a real `sudo reboot`, not just a manual start.

---

## systemctl — service control

```bash
sudo systemctl status <unit>            # is it running? recent log lines? restart count?
sudo systemctl start <unit>
sudo systemctl stop <unit>
sudo systemctl restart <unit>           # stop + start
sudo systemctl reload <unit>            # re-read config WITHOUT dropping connections (mosquitto supports this)
sudo systemctl enable <unit>            # start automatically at boot (symlinks only, doesn't start it now)
sudo systemctl disable <unit>           # remove from boot
sudo systemctl daemon-reload            # REQUIRED after editing/copying any unit file - systemd caches unit files in memory
```

**This project's units:**
```bash
sudo systemctl status iot.target mosquitto iot-collector iot-api --no-pager
sudo systemctl start iot.target         # starts mosquitto -> iot-collector -> iot-api in order
```

**`reload` vs `restart`:** use `reload` after changing mosquitto's password/ACL files — it re-reads them without disconnecting devices already online. `restart` fully stops and starts the process (drops connections); only needed for changes `reload` can't pick up (e.g. `conf.d/*.conf` structural changes).

**`enable` vs `start`:** separate on purpose. `enable` = "start this at next boot." `start` = "start this right now." Doing one doesn't imply the other.

---

## journalctl — reading service logs

```bash
journalctl -u <unit> -n 30 --no-pager       # last 30 lines, don't page (good for pasting)
journalctl -u <unit> -b --no-pager          # logs from the CURRENT boot only
journalctl -u <unit> -f                     # follow live, like tail -f
```

**Debugging workflow used repeatedly in this project:**
1. `systemctl status <unit>` first — gives exit code (`status=13` = permission denied, `status=1` = generic failure)
2. `journalctl -u <unit> -n 30 --no-pager` — full error/traceback
3. Fix, then `daemon-reload` (if unit file changed) + `restart`
4. Re-check `status`

---

## File permissions

```bash
ls -l <file>                                # check owner/group/mode
sudo chown <user>:<group> <file>
sudo chmod 640 <file>                       # owner rw, group r, others none — used for mosquitto passwd/acl
```

**Common trap hit in this project:** a file created by `sudo` (root) but read by a service running as a different user (e.g. `mosquitto`) → permission denied at service start, not at file-creation time. Always check ownership matches the user in the unit's `User=`/service account after creating config files as root.

---

## Mosquitto-specific

```bash
sudo mosquitto -c /etc/mosquitto/mosquitto.conf     # run in FOREGROUND — prints config errors directly to terminal (Ctrl+C to stop)

sudo mosquitto_passwd -c -b <passwd_file> <user> <pass>   # -c creates a NEW file (wipes existing!)
sudo mosquitto_passwd -b <passwd_file> <user> <pass>      # add/overwrite one entry, file must already exist

cut -d: -f1 /etc/mosquitto/passwd           # list registered usernames (hashes hidden)

mosquitto_sub -h localhost -u <user> -P <pass> -t 'home/devices/#' -v    # watch live traffic, -v prints topic + payload
mosquitto_sub -h localhost -u <user> -P <pass> -t '$SYS/broker/clients/connected' -v   # live connected-client count
```

⚠️ `-c` on `mosquitto_passwd` **overwrites the whole password file** — never use it when adding to an existing file, only for first-time creation.

---

## Database (SQLite)

```bash
sqlite3 telemetry.db "SELECT device_name, online, last_seen FROM devices JOIN device_status ON devices.id = device_status.device_id;"
```

---

## API quick checks

```bash
curl http://localhost:5000/api/health
curl http://localhost:5000/api/devices
```

---

## Misc

```bash
openssl rand -base64 18                     # generate a random password (used in add_device.sh)
sudo sed -i 's/OLD/NEW/' <file>             # in-place find/replace, e.g. renaming smarthome.target -> iot.target
sudo mv <old> <new>                         # rename/move file or directory
sudo mkdir -p <path>                        # create directory (and parents), no error if it already exists
sudo rmdir <path>                           # remove EMPTY directory only
```

---

## This project's key paths

| What | Path |
|---|---|
| Mosquitto config | `/etc/mosquitto/conf.d/iot.conf` |
| Mosquitto password file | `/etc/mosquitto/passwd` |
| Mosquitto ACL file | `/etc/mosquitto/acl` |
| Device credential script | `/opt/iot/add_device.sh` |
| systemd units | `/etc/systemd/system/{iot-collector,iot-api,iot}.target,.service` |
| Collector code | `/home/farzad/iot/collector/` |
