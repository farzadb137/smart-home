# smart-door-sensor firmware

Device: `devices/smart-door-sensor`

IDF project name is still `door_sensor` (kept so the hub's OTA upload, which reads the
project name from the binary, behaves as before).

```bash
idf.py set-target esp32c6
idf.py build flash monitor
```

`partitions.csv` is the two-slot OTA table that used to live in `firmware/common/`.
It is not selected automatically: set it in `menuconfig` (Partition Table -> Custom) or via `sdkconfig.defaults`.
