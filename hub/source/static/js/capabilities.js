// Shared capability metadata used by device cards and device detail pages.

export const CAPABILITY_FORMATTERS = {
    temperature: (value) => value == null ? "--" : `${Number(value).toFixed(1)} °C`,
    humidity: (value) => value == null ? "--" : `${Number(value).toFixed(0)} %`,
    switch: (value) => value ? "On" : "Off",
    contact: (value) => value ? "Open" : "Closed",
    brightness: (value) => value == null ? "--" : `${Math.round(Number(value))}%`,
    target_temperature: (value) => value == null ? "--" : `${Number(value).toFixed(1)} °C`,
};

export const CAPABILITY_LABELS = {
    switch: "Switch",
    temperature: "Temperature",
    humidity: "Humidity",
    contact: "Contact sensor",
    brightness: "Brightness",
    target_temperature: "Target temperature",
};

const CAPABILITY_PRIORITY = [
    "switch",
    "brightness",
    "target_temperature",
    "temperature",
    "humidity",
    "contact",
];

export function formatCapabilityValue(capability, value) {
    const formatter = CAPABILITY_FORMATTERS[capability];
    if (formatter) return formatter(value);
    return value == null ? "--" : String(value);
}

export function getCapabilityLabel(name) {
    return CAPABILITY_LABELS[name] || name.replace(/_/g, " ");
}

export function getPrimaryCapability(device) {
    const capabilities = Object.keys(device.readings || {});
    return CAPABILITY_PRIORITY.find(name => capabilities.includes(name)) || capabilities[0] || null;
}

export function getSecondaryCapabilities(device, limit = 2) {
    const primary = getPrimaryCapability(device);
    return Object.keys(device.readings || {})
        .filter(name => name !== primary)
        .sort((a, b) => {
            const ai = CAPABILITY_PRIORITY.indexOf(a);
            const bi = CAPABILITY_PRIORITY.indexOf(b);
            return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        })
        .slice(0, limit);
}
