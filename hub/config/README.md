# Hub system config

Files to install on the hub (originally `hub/etc/`). Private keys (`broker.key`, `api.key`) are NOT in git.

| File here | Install to |
|-----------|------------|
| `mosquitto/smart-hub.conf` | `/etc/mosquitto/conf.d/smart-hub.conf` |
| `mosquitto/tls.conf` | `/etc/mosquitto/conf.d/tls.conf` |
| `mosquitto/acl` | `/etc/mosquitto/acl` |
| `certs/ca.crt`, `certs/broker.crt` | `/etc/mosquitto/certs/` |
| `certs/api.crt` | `/etc/smart-hub/certs/api.crt` |
| `journald/smart-hub.conf` | `/etc/systemd/journald.conf.d/smart-hub.conf` |
