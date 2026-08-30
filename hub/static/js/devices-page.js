import { appState } from "./state.js";
import { renderDeviceList } from "./components/device-list.js";
import { renderDeviceDetail, updateDeviceDetailValues } from "./components/device-detail.js";

let currentRoute = { name: "overview", param: null };

function container() {
    return document.getElementById("devices-page");
}

export function initDevicesPage(onRouteChangeFn) {
    onRouteChangeFn((route) => {
        currentRoute = route;
        renderForRoute();
    });
}

function renderForRoute() {
    const root = container();
    if (!root || currentRoute.name !== "devices")
        return;

    if (!appState.apiOnline) {
        root.innerHTML = `<p style="color:var(--color-text-muted)">API offline.</p>`;
        return;
    }

    if (currentRoute.param) {
        const device = appState.devices.find(d => d.hardware_id_hex === currentRoute.param);
        if (!device) {
            root.innerHTML = `<p style="color:var(--color-text-muted)">Device not found. <a href="#devices">Back to devices</a></p>`;
            return;
        }
        renderDeviceDetail(root, device);
    } else {
        renderDeviceList(root, appState.devices);
    }
}

/**
 * Called on every dashboard data poll. Does NOT do a full re-render
 * (that would rebuild the chart / discard in-progress rename or upload
 * form state on every 30s tick) - only refreshes values in place.
 */
export function refreshDevicesPage() {
    if (currentRoute.name !== "devices")
        return;

    if (currentRoute.param) {
        const device = appState.devices.find(d => d.hardware_id_hex === currentRoute.param);
        if (device)
            updateDeviceDetailValues(device);
    } else {
        renderDeviceList(container(), appState.devices);
    }
}