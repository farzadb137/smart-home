import { CAPABILITY_ICONS, DEFAULT_ICON } from "../icons.js";
import { formatDeviceName } from "../utils.js";
import { formatCapabilityValue, getPrimaryCapability } from "../capabilities.js";

export function renderDeviceList(container, devices) {
    if (!container)
        return;

    if (devices.length === 0) {
        container.innerHTML = `<p style="color:var(--color-text-muted)">No devices yet.</p>`;
        return;
    }

    container.innerHTML = `<div class="devices-list devices-page-grid"></div>`;
    const grid = container.querySelector(".devices-page-grid");

    devices.forEach(device => {
        const capability = getPrimaryCapability(device);
        const icon = capability ? (CAPABILITY_ICONS[capability] || DEFAULT_ICON) : DEFAULT_ICON;

        const card = document.createElement("a");
        card.href = `#devices/${device.hardware_id_hex}`;
        card.classList.add("device-card", "device-card-link");

        card.innerHTML = `
            <div class="device-card-top">
                <span class="device-card-icon">${icon}</span>
                <span class="device-card-status-dot ${device.online ? "online" : "offline"}"></span>
            </div>
            <strong class="device-card-name">${formatDeviceName(device.name)}</strong>
            <small class="device-card-subtitle">${device.online ? "Online" : "Offline"}${device.parent_name ? ` · via ${formatDeviceName(device.parent_name)}` : ""}</small>
            ${capability ? `<div class="device-card-value">${formatCapabilityValue(capability, device.readings?.[capability]?.value)}</div>` : ""}
        `;

        grid.append(card);
    });
}