# Hardware Review Checklist

Run this **before sending any board to fabrication**. One checklist per revision; store the filled copy in the board folder.

## Board identity
- [ ] Board name and revision (`rev-X`) on schematic title block and silkscreen
- [ ] Repo folder matches board name; release folder prepared for this revision

## Schematic
- [ ] Power rails: correct voltage, current budget documented (ESP32-C6 WiFi TX burst covered)
- [ ] Decoupling on every supply pin; bulk caps near regulators
- [ ] Reverse polarity / ESD / TVS protection on external connectors
- [ ] ESP32-C6 boot straps (GPIO9/BOOT, EN, strapping pins) correct — no pull-up/down conflicts
- [ ] Flash/UART header present and wired per ESP-IDF docs (TX, RX, EN, BOOT, GND, 3V3)
- [ ] USB data lines (if used) with correct series resistors
- [ ] All nets named; no default net names
- [ ] No floating inputs; unused GPIOs documented (header or defined state)

## RF
- [ ] Antenna layout matches module/chip reference design
- [ ] Keep-out zones under antenna respected
- [ ] 50 Ω feed short and direct; ground stitching vias along it

## Layout
- [ ] Trace width/clearance meet fab capability
- [ ] No traces under the antenna area
- [ ] Crystal/RTC layout per datasheet (guard ring, nearby ground)
- [ ] Thermal relief on power pads; heat-generating parts have copper area
- [ ] Mounting holes: size and clearance per enclosure (`devices/<device>/mechanical/`)
- [ ] Connector orientation verified against enclosure/mechanical drawings
- [ ] Silkscreen: labels on all connectors, polarity marks, name + rev + date

## Manufacturing package
- [ ] Gerbers + drill files exported and visually verified (viewer)
- [ ] BOM: every part has MPN, value, package; no TBDs
- [ ] Pick & place matches courtyard
- [ ] Assembly notes (if hand-assembled): critical parts first, reflow/hand-solder notes

## Post-fab (bring-up)
- [ ] Power-on current measured and within budget (record value)
- [ ] 3V3 rail under load verified
- [ ] Flash + first boot OK
- [ ] WiFi range check done
- [ ] Bring-up report written in the board folder; errata → next revision idea list