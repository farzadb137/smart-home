# Contributing to smart-home

Thanks for helping build a local-first smart home platform. This document explains how the repo is organized and the rules that keep it healthy.

## Repository layout (quick recap)

| Folder | What lives here |
|---|---|
| `devices/` | Product definitions — each device is a recipe (`device.yaml`) combining boards, firmware and software |
| `hardware/` | Altium libraries, templates, reusable boards (one folder per board) |
| `firmware/` | ESP-IDF components, board support packages (BSP), per-device apps |
| `hub/` | Python backend (broker config, DB, API), web dashboard, deploy scripts |
| `protocol/` | Single source of truth: MQTT topics (`protocol/mqtt-topics.yaml`), payload schemas, REST API spec |
| `docs/` | Architecture, ADRs, processes, guides |
| `tools/` | Code generation, provisioning, release scripts |
| `tests/` | Integration and hardware-in-the-loop tests |

## Ground rules

1. **The protocol folder is law.** Never hard-code a topic string in firmware or the hub — always reference `protocol/mqtt-topics.yaml` (or the generated code in `protocol/generated/`). If a topic changes, change the YAML first, regenerate, then update consumers.
2. **Secrets never get committed.** Use the `*.example` templates (see `hub/secrets.example`). Credentials live outside git.
3. **Boards are frozen after fabrication.** Files in `hardware/boards/*/releases/` must not be modified — create a new revision instead (`rev-A`, `rev-B`, …).
4. **Naming:** folders in `kebab-case`, ESP-IDF components in `snake_case`.
5. **Tags:** `<device>/vX.Y.Z`, `hub/vX.Y.Z`, `board/<board>/rev-X`.
6. **Every user-visible change** gets a `CHANGELOG.md` entry under `## [Unreleased]` (Keep a Changelog format).

## Workflow

1. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `hw/<board>-<topic>`.
2. Keep commits small and imperative ("Add door-sensor debounce component").
3. Before opening a PR, make sure:
   - `firmware.yml` CI passes for any firmware change (`idf.py build`).
   - `hub.yml` CI passes for any hub change (lint + tests).
   - Docs are updated if behavior, structure or protocol changed.
   - New *architectural* decisions are recorded as an ADR in `docs/decisions/` (copy `0000-template.md`).
4. Open a PR describing **what**, **why**, and **how to test** it.

## Where documentation goes

- *What a thing is* → a `README.md` next to it.
- *How things fit together, why, and processes* → `docs/`.

See `docs/index.md` as the entry point.