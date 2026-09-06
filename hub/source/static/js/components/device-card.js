import { CAPABILITY_ICONS, DEFAULT_ICON } from "../icons.js";
import { formatDeviceName } from "../utils.js";
import { sendDeviceCommand } from "../api.js";
import { getPendingCommand, setPendingCommand, clearPendingCommand } from "../state.js";
import {
    formatCapabilityValue,
    getCapabilityLabel,
    getPrimaryCapability,
    getSecondaryCapabilities,
} from "../capabilities.js";

function renderControl(device, capability) {
    const value = device.readings?.[capability]?.value;

    if (capability === "switch") {
        const disabled = !device.online;
        return `
            <label class="device-toggle" title="${disabled ? "Device offline" : "Toggle device"}">
                <input type="checkbox" ${value ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="Toggle ${formatDeviceName(device.name)}">
                <span class="device-toggle-slider"></span>
            </label>
        `;
    }

    if (capability === "brightness") {
        const disabled = !device.online;
        const numericValue = Math.max(0, Math.min(100, Number(value ?? 0)));
        return `
            <label class="device-range-control" title="Brightness">
                <span class="device-range-icon" aria-hidden="true">${CAPABILITY_ICONS.brightness || DEFAULT_ICON}</span>
                <input class="device-range" type="range" min="0" max="100" step="1" value="${numericValue}" ${disabled ? "disabled" : ""} aria-label="Brightness for ${formatDeviceName(device.name)}">
                <span class="device-range-value">${numericValue}%</span>
            </label>
        `;
    }

    return `<div class="device-card-value">${formatCapabilityValue(capability, value)}</div>`;
}

function getDeviceState(device, capability) {
    if (!device.online) return "offline";
    if (capability === "switch") return device.readings?.switch?.value ? "active" : "idle";
    return "online";
}

function createCard(device, { link = false } = {}) {
    const capability = getPrimaryCapability(device);
    const secondaryCapabilities = getSecondaryCapabilities(device, 2);
    const icon = capability ? (CAPABILITY_ICONS[capability] || DEFAULT_ICON) : DEFAULT_ICON;
    const name = formatDeviceName(device.name);
    const parent = device.parent_name ? ` · via ${formatDeviceName(device.parent_name)}` : "";
    const state = getDeviceState(device, capability);
    const typeLabel = getCapabilityLabel(capability || device.type || "device");

    const card = document.createElement("article");
    card.classList.add("device-card", `device-card--${state}`);
    card.dataset.hardwareId = device.hardware_id_hex || "";

    const main = document.createElement("div");
    main.className = "device-card-main";

    const top = document.createElement("div");
    top.className = "device-card-top";
    top.innerHTML = `
        <span class="device-card-icon" aria-hidden="true">${icon}</span>
        <span class="device-card-status" title="${device.online ? "Online" : "Offline"}">
            <span class="device-card-status-dot ${device.online ? "online" : "offline"}"></span>
            <span>${device.online ? "Online" : "Offline"}</span>
        </span>
    `;

    const copy = document.createElement("div");
    copy.className = "device-card-copy";
    copy.innerHTML = `
        <span class="device-card-type">${typeLabel}</span>
        <strong class="device-card-name">${name}</strong>
        <small class="device-card-subtitle">${parent ? parent.replace(/^ · /, "") : "Connected device"}</small>
    `;

    if (link) {
        const nameEl = copy.querySelector(".device-card-name");
        const nameLink = document.createElement("a");
        nameLink.className = "device-card-name-link";
        nameLink.href = `#devices/${device.hardware_id_hex}`;
        nameLink.setAttribute("aria-label", `Open ${name}`);
        nameLink.append(nameEl);
        copy.append(nameLink);
    }

    main.append(top, copy);

    if (secondaryCapabilities.length) {
        const secondary = document.createElement("div");
        secondary.className = "device-card-secondary";
        secondary.innerHTML = secondaryCapabilities.map(name => {
            const value = device.readings?.[name]?.value;
            return `<span><small>${getCapabilityLabel(name)}</small><strong>${formatCapabilityValue(name, value)}</strong></span>`;
        }).join("");
        main.append(secondary);
    }

    card.append(main);

    if (capability) {
        const control = document.createElement("div");
        control.className = "device-card-control";
        control.innerHTML = renderControl(device, capability);
        card.append(control);
        wireControl(card, device, capability, control);
    }

    return card;
}

function wireControl(card, device, capability, control) {
    const toggleInput = control.querySelector(".device-toggle input");
    if (toggleInput) {
        toggleInput.addEventListener("change", async event => {
            const newValue = event.target.checked ? 1 : 0;
            setPendingCommand(device.hardware_id_hex, capability, newValue);
            event.target.disabled = true;
            card.classList.toggle("device-card--active", Boolean(newValue));
            card.classList.toggle("device-card--idle", !newValue);
            try {
                const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", { name: capability, value: newValue });
                if (result.success) {
                    if (device.readings?.[capability]) device.readings[capability].value = newValue;
                    // Keep the desired state until telemetry confirms it.
                } else {
                    clearPendingCommand(device.hardware_id_hex, capability);
                    event.target.checked = !event.target.checked;
                    card.classList.toggle("device-card--active", event.target.checked);
                    card.classList.toggle("device-card--idle", !event.target.checked);
                }
            } catch (error) {
                clearPendingCommand(device.hardware_id_hex, capability);
                event.target.checked = !event.target.checked;
                card.classList.toggle("device-card--active", event.target.checked);
                card.classList.toggle("device-card--idle", !event.target.checked);
                console.error("Command failed:", error);
            } finally {
                event.target.disabled = false;
            }
        });
    }

    const range = control.querySelector(".device-range");
    if (range) {
        const valueEl = control.querySelector(".device-range-value");
        let previousValue = Number(range.value);
        range.addEventListener("input", () => {
            valueEl.textContent = `${range.value}%`;
        });
        range.addEventListener("change", async () => {
            const newValue = Number(range.value);
            setPendingCommand(device.hardware_id_hex, capability, newValue);
            range.disabled = true;
            try {
                const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", { name: capability, value: newValue });
                if (result.success) {
                    previousValue = newValue;
                    if (device.readings?.[capability]) device.readings[capability].value = newValue;
                } else {
                    clearPendingCommand(device.hardware_id_hex, capability);
                    range.value = String(previousValue);
                    valueEl.textContent = `${previousValue}%`;
                }
            } catch (error) {
                clearPendingCommand(device.hardware_id_hex, capability);
                range.value = String(previousValue);
                valueEl.textContent = `${previousValue}%`;
                console.error("Command failed:", error);
            } finally {
                range.disabled = false;
            }
        });
    }
}

export function updateDeviceCards(container, devices) {
    if (!container) return;
    const byId = new Map((devices || []).map(device => [String(device.hardware_id_hex), device]));

    container.querySelectorAll(".device-card[data-hardware-id]").forEach(card => {
        const device = byId.get(String(card.dataset.hardwareId));
        if (!device) return;

        const capability = getPrimaryCapability(device);
        const state = getDeviceState(device, capability);
        card.classList.remove("device-card--online", "device-card--offline", "device-card--active", "device-card--idle");
        card.classList.add(`device-card--${state}`);

        const dot = card.querySelector(".device-card-status-dot");
        const status = card.querySelector(".device-card-status");
        if (dot) {
            dot.classList.toggle("online", Boolean(device.online));
            dot.classList.toggle("offline", !device.online);
        }
        if (status) {
            status.title = device.online ? "Online" : "Offline";
            const label = status.querySelector("span:last-child");
            if (label) label.textContent = device.online ? "Online" : "Offline";
        }

        const toggle = card.querySelector(".device-toggle input");
        if (toggle && document.activeElement !== toggle) {
            const pending = getPendingCommand(device.hardware_id_hex, "switch");
            const telemetryValue = Boolean(device.readings?.switch?.value);
            if (pending && telemetryValue === Boolean(pending.value)) clearPendingCommand(device.hardware_id_hex, "switch");
            const desired = getPendingCommand(device.hardware_id_hex, "switch");
            toggle.checked = desired ? Boolean(desired.value) : telemetryValue;
            toggle.disabled = !device.online || Boolean(desired);
        }

        const range = card.querySelector(".device-range");
        const rangeValue = card.querySelector(".device-range-value");
        if (range && document.activeElement !== range) {
            const telemetryValue = Math.max(0, Math.min(100, Number(device.readings?.brightness?.value ?? 0)));
            const pending = getPendingCommand(device.hardware_id_hex, "brightness");
            if (pending && telemetryValue === Number(pending.value)) clearPendingCommand(device.hardware_id_hex, "brightness");
            const desired = getPendingCommand(device.hardware_id_hex, "brightness");
            const value = desired ? Number(desired.value) : telemetryValue;
            range.value = String(value);
            if (rangeValue) rangeValue.textContent = `${value}%`;
            range.disabled = !device.online || Boolean(desired);
        }

        const secondary = card.querySelector(".device-card-secondary");
        if (secondary) {
            const names = getSecondaryCapabilities(device, 2);
            secondary.innerHTML = names.map(name => {
                const value = device.readings?.[name]?.value;
                return `<span><small>${getCapabilityLabel(name)}</small><strong>${formatCapabilityValue(name, value)}</strong></span>`;
            }).join("");
        }
    });
}

export function renderDeviceCard(device, options = {}) {
    return createCard(device, options);
}

export function renderDeviceCards(container, devices, options = {}) {
    if (!container) return;
    container.innerHTML = "";
    if (!devices.length) {
        const emptyTitle = options.emptyTitle || "No devices yet";
        const emptyText = options.emptyText || "Connect a device to start controlling and monitoring your home.";
        container.innerHTML = `<div class="empty-state device-empty-state"><strong>${emptyTitle}</strong><p>${emptyText}</p></div>`;
        return;
    }
    devices.forEach(device => container.append(createCard(device, options)));
}
