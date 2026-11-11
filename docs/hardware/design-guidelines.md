# Hardware Design Guidelines

Applies to all boards under `hardware/` (Altium).

## Project structure

```
hardware/
├── libs/        # shared Altium libraries, templates
├── boards/      # one folder per board
│   └── <board>/
│       ├── <board>.PrjPcb
│       ├── releases/     # FROZEN after fabrication — never edit
│       └── ...           # work-in-progress design files
```

- Board folders: `kebab-case` (`smart-hub-power`), signals per net naming convention.
- Revisions: `rev-A`, `rev-B`… Once a revision's files are in `releases/` they are **frozen**; fixes mean a new revision.

## Design rules

### Power
- ESP32-C6: 3.3 V rail sized for WiFi TX bursts — budget ≥ 500 mA headroom.
- Bulk + local decoupling: ≥10 µF bulk near the module, 100 nF per supply pin.
- Battery devices: measure and document sleep current; target µA range. [TODO: product targets]

### RF (ESP32-C6 / 2.4 GHz)
- Follow the module/chip antenna reference layout: keep-out under and around the antenna, no ground pour under the antenna section.
- Keep antenna edge-of-board; route 50 Ω traces short and straight with ground stitching.

### Connectors & programming
- Every board exposes a flashing/UART header (or documents its USB flashing path) plus SWD where applicable.
- Pin headers for unused GPIOs on development revisions.

### Protection
- Reverse polarity and ESD protection on all externally reachable connectors.
- Inputs from the outside world: series resistor + clamp as needed.

### PCB
- Minimum trace/clearance per fab capability: [TODO: e.g. 6/6 mil, 1 oz]
- Silkscreen: board name, revision, date, and connector labels — a board must be understandable without the schematic.
- Mounting holes on every board; specify them in the mechanical folder of the device.

## Documentation per board

Each board folder must contain:
- `README.md` — purpose, key features, power budget, connector pinout.
- BOM (CSV) per revision.
- Fabrication outputs (Gerbers, drill, pick&place) in `releases/rev-X/`.

## Review process

1. Run the [review checklist](review-checklist.md) before sending any board to fab.
2. Reviews happen on a rendered schematic + layout export (PDF/images) — reviewable files stay in the repo, not just in Altium.
3. After fab and bring-up, write a short bring-up report in the board folder: what worked, what changed, errata.