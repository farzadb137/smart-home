// Single source of truth for how capability values are displayed and
// which capability a device card leads with. Was previously duplicated
// across devices.js, device-list.js, and device-detail.js - consolidated
// here so a new capability type (or a formatting fix) only needs to
// change in one place.

export const CAPABILITY_FORMATTERS = {
    temperature: (value) => value == null ? "--" : `${Number(value).toFixed(1)} °C`,
    switch: (value) => value ? "On" : "Off",
    contact: (value) => value ? "Open" : "Closed",
};

export function formatCapabilityValue(capability, value) {
    const formatter = CAPABILITY_FORMATTERS[capability];
    if (formatter)
        return formatter(value);
    return value == null ? "--" : String(value);
}

export function getPrimaryCapability(device) {
    const capabilities = Object.keys(device.readings || {});
    return capabilities.length > 0 ? capabilities[0] : null;
}