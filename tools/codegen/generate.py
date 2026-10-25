"""Generate C header and Python constants from protocol/mqtt-topics.yaml."""
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]
spec = yaml.safe_load((ROOT / "protocol" / "mqtt-topics.yaml").read_text())
out = ROOT / "protocol" / "generated"
out.mkdir(exist_ok=True)

h = ["#pragma once", "/* Generated - do not edit */"]
py = ["# Generated - do not edit"]
for name, t in spec["topics"].items():
    pat = t["pattern"].replace("{device_type}", "%s").replace("{device_id}", "%s").replace("{child_id}", "%s")
    h.append(f'#define TOPIC_{name.upper()} "{pat}"')
    py.append(f'TOPIC_{name.upper()} = "{t["pattern"]}"')

(out / "topics.h").write_text("\n".join(h) + "\n")
(out / "topics.py").write_text("\n".join(py) + "\n")
print("generated:", out)
