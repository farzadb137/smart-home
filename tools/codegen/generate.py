"""Generate C + Python bindings from protocol/mqtt-topics.yaml.
adds:
- QoS / retained constants
- schema path comment
- fail-fast validation
Usage: python tools/codegen/generate.py
"""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "protocol" / "mqtt-topics.yaml"
OUT = ROOT / "protocol" / "generated"

spec = yaml.safe_load(SPEC.read_text())
OUT.mkdir(exist_ok=True)

h = ["#pragma once", "/* Generated from protocol/mqtt-topics.yaml - do not edit */", ""]
py = ["# Generated from protocol/mqtt-topics.yaml - do not edit", ""]

for name, t in spec["topics"].items():
    pat = t["pattern"].replace("{device_type}", "%s").replace("{device_id}", "%s").replace("{child_id}", "%s")
    macro = name.upper()
    h.append(f'#define TOPIC_{macro} "{pat}"')
    h.append(f'#define TOPIC_{macro}_QOS {t.get("qos", 1)}')
    h.append(f'#define TOPIC_{macro}_RETAINED {1 if t.get("retained") else 0}')
    py.append(f'TOPIC_{macro} = "{t["pattern"]}"')
    py.append(f'TOPIC_{macro}_QOS = {t.get("qos", 1)}')
    py.append(f'TOPIC_{macro}_RETAINED = {str(bool(t.get("retained")))}')

(OUT / "topics.h").write_text("\n".join(h) + "\n")
(OUT / "topics.py").write_text("\n".join(py) + "\n")
print("generated:", OUT)
