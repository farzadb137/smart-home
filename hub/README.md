# Smart Hub software

Runs on the Orange Pi.

- `backend/src/hub/` – Flask API (`api.py`), MQTT collector (`mqtt_collector.py`), DB maintenance (`hub_maintenance.py`), `hub_app/`, `database/`
- `backend/scripts/` – admin helpers (e.g. `set_password.py`)
- `dashboard/` – web UI served by the Flask app
- `config/` – Mosquitto, certificates (public), journald config
- `secrets.example/` – templates for `/etc/smart-hub/secrets.env`
- `deploy/systemd/` – service, timer and target units

The code still uses flat imports (`from hub_app import ...`), so run scripts from `backend/src/hub`:

```bash
cd hub/backend/src/hub
python -m venv ../../../../.venv && source ../../../../.venv/bin/activate
pip install -r ../../requirements.txt
BROKER_PASSWORD=x HUB_COMMANDER_PASSWORD=y python api.py
```

Runtime data (`hub/data/smart.db`, `hub/data/firmware/`) is git-ignored.
