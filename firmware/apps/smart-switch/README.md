# smart-switch firmware

Device: `devices/smart-switch`

IDF project name is still `switch` (kept so the hub's OTA upload, which reads the
project name from the binary, behaves as before).

```bash
idf.py set-target esp32c6
idf.py build flash monitor
```

`partitions.csv` is the two-slot OTA table that used to live in `firmware/common/`.
It is not selected automatically: set it in `menuconfig` (Partition Table -> Custom) or via `sdkconfig.defaults`.
