import { appState } from "./state.js";
import { renderDeviceList } from "./components/device-list.js";
import { renderDeviceDetail, updateDeviceDetailValues } from "./components/device-detail.js";

let currentRoute = { name: "overview", param: null };

// Tracks which route+param currently has a FULL render sitting in the
// DOM. null/mismatch means the next refresh must do a full render
// (fresh load, just switched routes, or recovering from an
// offline/loading state) rather than the lightweight value-patch path,
// which assumes the real markup already exists.
let renderedRouteKey = null;

function container() {
    return document.getElementById("devices-page");
}

function routeKey(route) {
    return `${route.name}/${route.param || ""}`;
}

export function initDevicesPage(onRouteChangeFn) {
    onRouteChangeFn((route) => {
        currentRoute = route;
        renderedRouteKey = null;
        renderForRoute();
    });
}

function renderForRoute() {
    const root = container();
    if (!root || currentRoute.name !== "devices")
        return;

    if (!appState.hasLoadedOnce) {
        root.innerHTML = `<p style="color:var(--color-text-muted)">Loading...</p>`;
        renderedRouteKey = null;
        return;
    }

    if (!appState.apiOnline) {
        root.innerHTML = `<p style="color:var(--color-text-muted)">API offline.</p>`;
        renderedRouteKey = null;
        return;
    }

    if (currentRoute.param) {
        const device = appState.devices.find(d => d.hardware_id_hex === currentRoute.param);
        if (!device) {
            root.innerHTML = `<p style="color:var(--color-text-muted)">Device not found. <a href="#devices">Back to devices</a></p>`;
            renderedRouteKey = null;
            return;
        }
        renderDeviceDetail(root, device);
    } else {
        renderDeviceList(root, appState.devices);
    }

    renderedRouteKey = routeKey(currentRoute);
}

/**
 * Called on every dashboard data poll, including the very first load.
 * Does a full render if the current route hasn't had its real DOM built
 * yet (first load, route just changed, or recovering from a loading/
 * offline placeholder) - otherwise patches values in place only, since
 * a full re-render on every 30s poll would reset the history chart and
 * wipe out any in-progress rename/upload form state.
 */
export function refreshDevicesPage() {
    if (currentRoute.name !== "devices")
        return;

    if (renderedRouteKey !== routeKey(currentRoute)) {
        renderForRoute();
        return;
    }

    if (currentRoute.param) {
        const device = appState.devices.find(d => d.hardware_id_hex === currentRoute.param);
        if (device)
            updateDeviceDetailValues(device);
    } else {
        renderDeviceList(container(), appState.devices);
    }
}