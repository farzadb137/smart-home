# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
- Protocol source of truth: schemas/, openapi.yaml, generated topics.h/py, contract tests
- BSP extracted for temp/switch/door, pins single-source
- button_manager_init(gpio), led_manager_init(gpio,count) from BSP
### Added
- Initial repository structure.

## Restructure
- Repository moved to the monorepo layout (devices / hardware / firmware / hub / protocol / docs / tools).
