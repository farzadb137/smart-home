# Hub setup & deployment

Assumes the repo is cloned to `~/smart-hub` on the Orange Pi and the virtualenv is `~/smart-hub/.venv`.

1. Python deps: `pip install -r hub/backend/requirements.txt`
2. Mosquitto + certs: see the install table in `hub/config/README.md`; create `/etc/mosquitto/passwd`.
3. Secrets: copy `hub/secrets.example/secrets.env` to `/etc/smart-hub/secrets.env` and fill it in.
4. Services: copy `hub/deploy/systemd/*` to `/etc/systemd/system/`, then
   `sudo systemctl enable --now smart.target smart-maintenance.timer`
5. Runtime data lives in `hub/data/` (set `DATABASE_PATH` / `FIRMWARE_DIR` to keep an existing location).
