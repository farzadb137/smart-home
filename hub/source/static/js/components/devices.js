import { renderDeviceCards } from "./device-card.js";

export function renderDevices(devices) {
    const container = document.querySelector(".devices-list");

    if (!container) {
        console.error("Devices container not found in DOM.");
        return;
    }

    renderDeviceCards(container, devices);
}
