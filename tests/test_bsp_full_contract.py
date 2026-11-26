"""BSP contract FULL — Phase B-full. Run: pytest tests/test_bsp_full_contract.py -v
Requires B-minimal already applied (firmware/bsp/*/rev-A + BSP_ in capability_drivers).
Checks that button (GPIO20) + LED (GPIO8) are no longer hardcoded in managers
but come from bsp.h via init args.
"""
import pathlib, re
REPO = pathlib.Path(__file__).resolve().parents[1]

APPS = ["smart-temp-sensor", "smart-switch", "smart-door-sensor"]

def test_no_hardcoded_ui_pins_in_components():
    bad = []
    btn_c = REPO / "firmware" / "components" / "button_manager" / "src" / "button_manager.c"
    led_c = REPO / "firmware" / "components" / "led_manager" / "src" / "led_manager.c"
    assert btn_c.exists(), f"missing {btn_c}"
    assert led_c.exists(), f"missing {led_c}"
    bt = btn_c.read_text()
    lt = led_c.read_text()
    if re.search(r"#define\s+BUTTON_PIN\b", bt):
        bad.append("button_manager.c still defines BUTTON_PIN")
    if "GPIO_NUM_20" in bt and "s_button_gpio" not in bt:
        bad.append("button_manager.c still uses GPIO_NUM_20 directly")
    if re.search(r"#define\s+LED_GPIO\b", lt):
        bad.append("led_manager.c still defines LED_GPIO")
    if re.search(r"#define\s+LED_COUNT\b", lt):
        bad.append("led_manager.c still defines LED_COUNT")
    assert not bad, bad

def test_init_signatures_take_gpio():
    bh = REPO / "firmware" / "components" / "button_manager" / "include" / "button_manager.h"
    lh = REPO / "firmware" / "components" / "led_manager" / "include" / "led_manager.h"
    assert bh.exists() and lh.exists()
    bt = bh.read_text()
    lt = lh.read_text()
    # button must take one int/gpio param, led must take two params
    assert re.search(r"button_manager_init\s*\(\s*(int|gpio_num_t)[^)]*\)", bt), \
        f"button_manager.h must be button_manager_init(int gpio_num), got: {bt[-400:]}"
    m = re.search(r"led_manager_init\s*\(([^)]*)\)", lt)
    assert m, "led_manager.h missing led_manager_init(...)"
    params = m.group(1)
    assert params.count(",") == 1, f"led_manager_init must take 2 params (gpio,count), got ({params})"

def test_sources_use_param_not_define():
    btn_c = (REPO / "firmware" / "components" / "button_manager" / "src" / "button_manager.c").read_text()
    led_c = (REPO / "firmware" / "components" / "led_manager" / "src" / "led_manager.c").read_text()
    assert "s_button_gpio" in btn_c, "button_manager.c must store param in s_button_gpio"
    assert "s_led_gpio" in led_c and "s_led_count" in led_c, "led_manager.c must store s_led_gpio/s_led_count"
    # init bodies must use stored var, not hardcoded number
    assert "gpio_get_level(s_button_gpio)" in btn_c or "s_button_gpio" in btn_c
    assert ".strip_gpio_num" in led_c and "s_led_gpio" in led_c

def test_mains_pass_bsp_pins():
    bad = []
    for app in APPS:
        m = REPO / "firmware" / "apps" / app / "main" / "main.c"
        if not m.exists():
            continue
        t = m.read_text()
        if "button_manager_init(BSP_BUTTON_GPIO)" not in t:
            bad.append(f"{app}: missing button_manager_init(BSP_BUTTON_GPIO)")
        if "led_manager_init(BSP_LED_GPIO" not in t:
            bad.append(f"{app}: missing led_manager_init(BSP_LED_GPIO, ...)")
        if "BSP_LED_COUNT" not in t:
            bad.append(f"{app}: missing BSP_LED_COUNT")
        # ordering: bsp_init before led init
        if "bsp_init()" in t and "led_manager_init" in t:
            if t.index("bsp_init()") > t.index("led_manager_init"):
                bad.append(f"{app}: bsp_init() must be before led_manager_init()")
        else:
            bad.append(f"{app}: missing bsp_init()/led init")
    assert not bad, bad

def test_bsp_still_single_source():
    # regression: bsp.h must still define UI pins (B-minimal guarantee)
    for board in APPS:
        h = REPO / "firmware" / "bsp" / board / "rev-A" / "include" / "bsp.h"
        assert h.exists(), f"missing {h} (did B-minimal get lost?)"
        t = h.read_text()
        assert "BSP_BUTTON_GPIO" in t and "20" in t, f"{board} bsp.h missing BUTTON 20"
        assert "BSP_LED_GPIO" in t and "BSP_LED_COUNT" in t, f"{board} bsp.h missing LED defines"
