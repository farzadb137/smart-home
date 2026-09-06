import { renderDeviceCards, updateDeviceCards } from "./device-card.js";
import { renderHomeRoomsPreview } from "../rooms-page.js";

function getSwitchDevices(devices) {
    return devices.filter(device =>
        device.capabilities?.includes?.("switch") || device.readings?.switch
    );
}

export function renderHomeOverview(state, options = {}) {
    const totalEl = document.getElementById("home-device-count");
    const onlineEl = document.getElementById("home-online-count");
    const offlineEl = document.getElementById("home-offline-count");
    const quickControls = document.querySelector(".quick-controls-list");

    const devices = Array.isArray(state.devices) ? state.devices : [];
    const online = devices.filter(device => device.online).length;
    const offline = devices.length - online;

    if (totalEl) totalEl.textContent = String(devices.length);
    if (onlineEl) onlineEl.textContent = String(online);
    if (offlineEl) offlineEl.textContent = String(offline);

    if (quickControls) {
        const switchDevices = getSwitchDevices(devices).slice(0, 4);
        if (options.source === "poll") {
            updateDeviceCards(quickControls, switchDevices);
        } else {
            renderDeviceCards(quickControls, switchDevices, {
                emptyTitle: "No quick controls yet",
                emptyText: "Switch-capable devices will appear here when they are connected.",
            });
        }
    }

    renderHomeRoomsPreview(state, { source: options.source, quickControls: true });
}
