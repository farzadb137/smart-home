# Board Support Packages

`bsp/<board-id>/<rev>/` exposes the same API (`bsp.h`, `bsp_init()`) for every board revision,
so apps switch hardware by changing one path in their `CMakeLists.txt`.

No BSP exists yet: pin numbers currently live in each app's `main/capability_drivers.c`.
Create `bsp/<board-id>/rev-X/` when a second board revision needs the same app.
