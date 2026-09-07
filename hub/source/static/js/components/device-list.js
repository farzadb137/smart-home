import { renderDeviceCards } from "./device-card.js";

export function renderDeviceList(container, devices, options = {}) {
    if (!container) return;
    container.innerHTML = "";
    renderDeviceCards(container, devices, {
        link: true,
        emptyTitle: options.filtered ? "No matching devices" : "No devices yet",
        emptyText: options.filtered ? "Try changing the search or filters." : "Connect a device to start controlling and monitoring your home.",
        selectable: Boolean(options.selectable),
        selectedIds: options.selectedIds || new Set(),
        onSelect: options.onSelect
    });
}
