# Mobile apps (planned)

## Decision pending
Record the choice as an ADR in `docs/decisions/`:
- Cross-platform (Flutter / React Native) -> code in `app/`
- Native -> `android/` and `ios/`

## Contract
Apps talk to the hub only through `protocol/api/openapi.yaml` (and BLE provisioning for setup).
