import { renderDeviceCards } from "./device-card.js";

export function renderDevices(devices) {
    const container = document.querySelector(".devices-list");

    if (!container) return;

    renderDeviceCards(container, devices);
}
