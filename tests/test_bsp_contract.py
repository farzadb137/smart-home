"""BSP contract — Phase B-minimal + B-full compatible. Run: pytest tests/test_bsp_contract.py -v
v2: checks for led_manager_init (any args) so it passes both before and after B-full.
Replace your old tests/test_bsp_contract.py with this file when applying B-full.
"""
import pathlib, re
REPO = pathlib.Path(__file__).resolve().parents[1]
BOARDS = {"smart-temp-sensor": "BSP_TEMP_GPIO", "smart-switch": "BSP_RELAY_GPIO", "smart-door-sensor": "BSP_CONTACT_GPIO"}
def test_bsp_exists_per_device():
    for board in ["smart-temp-sensor", "smart-switch", "smart-door-sensor"]:
        h = REPO / "firmware" / "bsp" / board / "rev-A" / "include" / "bsp.h"
        c = REPO / "firmware" / "bsp" / board / "rev-A" / "src" / "bsp.c"
        assert h.exists(), f"missing {h}"
        assert c.exists(), f"missing {c}"
        txt = h.read_text()
        assert "BSP_BOARD_ID" in txt and "bsp_init" in txt
        assert board in txt
def test_no_hardcoded_gpio_in_capability_drivers():
    bad = []
    for app in ["smart-temp-sensor", "smart-switch", "smart-door-sensor"]:
        p = REPO / "firmware" / "apps" / app / "main" / "capability_drivers.c"
        if not p.exists(): continue
        t = p.read_text()
        if re.search(r"#define\s+\w*GPIO\w*\s+(\d+|GPIO_NUM_\d+)", t): bad.append(f"{app}: local #define GPIO")
        if "BSP_" not in t: bad.append(f"{app}: no BSP_ include/use")
    assert not bad, bad
def test_main_calls_bsp_init():
    for app in ["smart-temp-sensor", "smart-switch", "smart-door-sensor"]:
        m = REPO / "firmware" / "apps" / app / "main" / "main.c"
        if not m.exists(): continue
        t = m.read_text()
        assert "bsp_init()" in t, f"{app}/main.c missing bsp_init()"
        # v2: match led_manager_init with ANY args (void before B-full, BSP_* after)
        assert "led_manager_init" in t, f"{app}: missing led_manager_init"
        assert t.index("bsp_init()") < t.index("led_manager_init"), f"{app}: bsp_init must be before led init"
def test_main_cmake_references_bsp():
    for app in ["smart-temp-sensor", "smart-switch", "smart-door-sensor"]:
        mk = REPO / "firmware" / "apps" / app / "main" / "CMakeLists.txt"
        if not mk.exists(): continue
        t = mk.read_text()
        assert "BSP_DIR" in t and "bsp.c" in t, f"{app}/main/CMakeLists.txt missing BSP_DIR/bsp.c"
