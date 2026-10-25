# Hardware

- `libraries/` – shared Altium libraries (`integrated/` holds compiled `.IntLib` files)
- `templates/` – sheet templates, design rules, OutJob files
- `boards/` – one folder per **reusable** board. Copy `_template/` to start a new board.

## Board folder layout
```
boards/<board-id>/
├── README.md        # purpose, interfaces, used-by list, revision history
├── source/          # .PrjPcb, .SchDoc, .PcbDoc (work in progress)
├── releases/rev-X/  # FROZEN fab outputs, never edited after ordering
└── notes/           # bring-up logs, errata, rework
```

## Release checklist (per revision)
1. Design review done (`docs/hardware/review-checklist.md`)
2. Run OutJob -> copy outputs into `releases/rev-X/`
3. Fill `releases/rev-X/RELEASE.md`
4. Commit + tag `board/<board-id>/rev-X`
