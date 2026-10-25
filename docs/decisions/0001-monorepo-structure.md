# 0001 – Monorepo structure

- Status: accepted
- Date: 2026-10-24

## Context
Multiple devices share boards, firmware components and protocol definitions.

## Decision
Single repository. Boards and firmware components are reusable units; devices reference them via `device.yaml`.
Protocol definitions live in `protocol/` as the single source of truth.

## Consequences
One place to change shared parts; requires Git LFS for Altium binaries.
