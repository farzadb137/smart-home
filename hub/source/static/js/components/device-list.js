import { renderDeviceCards } from "./device-card.js";

export function renderDeviceList(container, devices) {
    if (!container) return;

    container.innerHTML = `<div class="devices-list devices-page-grid"></div>`;
    renderDeviceCards(container.querySelector(".devices-page-grid"), devices, { link: true });
}
