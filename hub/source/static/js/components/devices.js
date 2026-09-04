import { CAPABILITY_ICONS, DEFAULT_ICON } from "../icons.js";
import { formatDeviceName } from "../utils.js";
import { sendDeviceCommand } from "../api.js";
import { formatCapabilityValue, getPrimaryCapability } from "../capabilities.js";

function renderControl(device, capability) {
    const value = device.readings?.[capability]?.value;

    if (capability === "switch") {
        const disabled = !device.online;
        return `
            <label class="device-toggle" title="${disabled ? "Device offline" : ""}">
                <input type="checkbox" ${value ? "checked" : ""} ${disabled ? "disabled" : ""}>
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
            <small class="device-card-subtitle">${device.online ? "Online" : "Offline"}${device.parent_name ? ` · via ${formatDeviceName(device.parent_name)}` : ""}</small>
            ${capability ? renderControl(device, capability) : ""}
        `;

        container.append(card);

        const toggleInput = card.querySelector(".device-toggle input");
        if (toggleInput) {
            toggleInput.addEventListener("change", async (event) => {
                const newValue = event.target.checked ? 1 : 0;
                event.target.disabled = true;
                try {
                    const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", { name: "switch", value: newValue });
                    if (result.success) {
                        if (device.readings?.switch)
                            device.readings.switch.value = newValue;
                    }
                    else {
                        console.error("Command rejected:", result.error);
                        event.target.checked = !event.target.checked;
                    }
                } catch (error) {
                    console.error("Command failed:", error);
                    event.target.checked = !event.target.checked;
                } finally {
                    event.target.disabled = false;
                }
            });
        }
    });
}