import { CAPABILITY_ICONS, DEFAULT_ICON } from "../icons.js";
import { formatDeviceName } from "../utils.js";

const CAPABILITY_FORMATTERS = {
    temperature: (value) => value == null ? "--" : `${Number(value).toFixed(1)} °C`,
    switch: (value) => value ? "On" : "Off",
    contact: (value) => value ? "Open" : "Closed",
};

function getPrimaryCapability(device) {
    const capabilities = Object.keys(device.readings || {});
    return capabilities.length > 0 ? capabilities[0] : null;
}

function formatCapabilityValue(capability, value) {
    const formatter = CAPABILITY_FORMATTERS[capability];
    if (formatter)
        return formatter(value);
    return value == null ? "--" : String(value);
}

function renderControl(device, capability) {
    const value = device.readings?.[capability]?.value;

    // Actuator capabilities get a toggle - disabled for now since
    // there's no command channel wired up yet (that's a later phase,
    // once real switch/actuator hardware exists). It still reflects
    // the device's last known state, just can't be operated yet.
    if (capability === "switch") {
        return `
            <label class="device-toggle" title="Control coming soon">
                <input type="checkbox" disabled ${value ? "checked" : ""}>
                <span class="device-toggle-slider"></span>
            </label>
        `;
    }

    return `<div class="device-card-value">${formatCapabilityValue(capability, value)}</div>`;
}

export function renderDevices(devices) {
    const container = document.querySelector(".devices-list");

    if (!container) {
        console.error("Devices container not found in DOM.");
        return;
    }

    container.innerHTML = "";

    devices.forEach(device => {
        const capability = getPrimaryCapability(device);
        const icon = capability ? (CAPABILITY_ICONS[capability] || DEFAULT_ICON) : DEFAULT_ICON;

        const card = document.createElement("div");
        card.classList.add("device-card");

        card.innerHTML = `
            <div class="device-card-top">
                <span class="device-card-icon">${icon}</span>
                <span class="device-card-status-dot ${device.online ? "online" : "offline"}"></span>
            </div>
            <strong class="device-card-name">${formatDeviceName(device.name)}</strong>
            <small class="device-card-subtitle">${device.online ? "Online" : "Offline"}</small>
            ${capability ? renderControl(device, capability) : ""}
        `;

        container.append(card);
    });
}