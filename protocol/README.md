# Protocol – single source of truth

Firmware, hub and mobile apps must all follow these definitions.
Change here first, then regenerate code with `tools/codegen/`.

- `mqtt-topics.yaml` – topic tree (matches the Mosquitto ACL)
- `generated/` – generated C / Python constants (do not edit by hand)

Payload schemas (`schemas/`) and the REST API spec (`api/openapi.yaml`) are not written yet; add them when the payloads are formalised.
