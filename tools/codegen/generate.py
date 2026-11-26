"""Generate C header and Python constants from protocol/mqtt-topics.yaml.

Option A hardened (A1-A3 close-out):
- emits TOPIC_* + TOPIC_*_QOS + TOPIC_*_RETAINED (firmware + hub single source)
- includes schema path as comment for traceability
- supports --check for CI (fail if protocol/generated/ is stale)
- never changes topic strings: only adds delivery metadata

Usage:
  python tools/codegen/generate.py           # regenerate
  python tools/codegen/generate.py --check   # CI: fail if out of date
"""
from pathlib import Path
import sys
import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = ROOT / "protocol" / "mqtt-topics.yaml"
OUT = ROOT / "protocol" / "generated"


def render(spec):
    h = ["#pragma once", "/* Generated from protocol/mqtt-topics.yaml - do not edit */", ""]
    py = ["# Generated from protocol/mqtt-topics.yaml - do not edit", ""]
    for name, t in spec["topics"].items():
        pat = t["pattern"].replace("{device_type}", "%s").replace("{device_id}", "%s").replace("{child_id}", "%s")
        macro = name.upper()
        qos = t.get("qos", 1)
        ret = 1 if t.get("retained") else 0
        schema = t.get("schema", "")
        if schema:
            h.append(f"/* schema: {schema} */")
        h.append(f'#define TOPIC_{macro} "{pat}"')
        h.append(f"#define TOPIC_{macro}_QOS {qos}")
        h.append(f"#define TOPIC_{macro}_RETAINED {ret}")
        h.append("")
        py.append(f'TOPIC_{macro} = "{t["pattern"]}"')
        py.append(f"TOPIC_{macro}_QOS = {qos}")
        py.append(f"TOPIC_{macro}_RETAINED = {str(bool(t.get('retained')))}")
        if schema:
            py.append(f"# schema: {schema}")
        py.append("")
    return ("\n".join(h).rstrip() + "\n", "\n".join(py).rstrip() + "\n")


def main():
    check = "--check" in sys.argv
    spec = yaml.safe_load(SPEC.read_text(encoding="utf-8"))
    h_text, py_text = render(spec)
    if check:
        old_h = (OUT / "topics.h").read_text(encoding="utf-8") if (OUT / "topics.h").exists() else ""
        old_py = (OUT / "topics.py").read_text(encoding="utf-8") if (OUT / "topics.py").exists() else ""
        if old_h != h_text or old_py != py_text:
            print("FAIL: protocol/generated/ is stale. Run: python tools/codegen/generate.py")
            sys.exit(1)
        print("generated: up to date")
        return
    OUT.mkdir(exist_ok=True)
    (OUT / "topics.h").write_text(h_text, encoding="utf-8")
    (OUT / "topics.py").write_text(py_text, encoding="utf-8")
    print("generated:", OUT)


if __name__ == "__main__":
    main()
