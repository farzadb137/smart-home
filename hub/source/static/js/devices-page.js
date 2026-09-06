import { appState } from "./state.js";
import { renderDeviceList } from "./components/device-list.js";
import { updateDeviceCards } from "./components/device-card.js";
import { renderDeviceDetail, updateDeviceDetailValues } from "./components/device-detail.js";
import { getPrimaryCapability, getCapabilityLabel } from "./capabilities.js";

let currentRoute = { name: "overview", param: null };
let renderedRouteKey = null;
let filters = { query: "", room: "", status: "all", type: "all" };

function container() { return document.getElementById("devices-page"); }
function routeKey(route) { return `${route.name}/${route.param || ""}`; }

function deviceType(device) {
    const capability = getPrimaryCapability(device);
    return capability || device.type || "device";
}

function filteredDevices() {
    const query = filters.query.trim().toLowerCase();
    return appState.devices.filter(device => {
        if (filters.room && String(device.room_id || "") !== filters.room) return false;
        if (filters.status === "online" && !device.online) return false;
        if (filters.status === "offline" && device.online) return false;
        if (filters.type !== "all" && deviceType(device) !== filters.type) return false;
        if (query) {
            const haystack = `${device.name || ""} ${device.room_name || ""} ${device.type || ""}`.toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        return true;
    });
}

function availableTypes() {
    return [...new Set(appState.devices.map(deviceType))].sort();
}

function filtersMarkup() {
    const roomOptions = appState.rooms.map(room =>
        `<option value="${room.id}" ${filters.room === String(room.id) ? "selected" : ""}>${escapeHtml(room.name)}</option>`
    ).join("");
    const typeOptions = availableTypes().map(type =>
        `<option value="${escapeAttr(type)}" ${filters.type === type ? "selected" : ""}>${escapeHtml(getCapabilityLabel(type))}</option>`
    ).join("");
    return `
        <div class="devices-toolbar" aria-label="Device filters">
            <label class="device-search">
                <span class="sr-only">Search devices</span>
                <input id="device-search-input" type="search" value="${escapeAttr(filters.query)}" placeholder="Search devices…" autocomplete="off">
            </label>
            <label class="device-filter-select">
                <span class="sr-only">Room</span>
                <select id="device-room-filter"><option value="">All rooms</option>${roomOptions}</select>
            </label>
            <label class="device-filter-select">
                <span class="sr-only">Status</span>
                <select id="device-status-filter">
                    <option value="all" ${filters.status === "all" ? "selected" : ""}>All status</option>
                    <option value="online" ${filters.status === "online" ? "selected" : ""}>Online</option>
                    <option value="offline" ${filters.status === "offline" ? "selected" : ""}>Offline</option>
                </select>
            </label>
            <label class="device-filter-select">
                <span class="sr-only">Type</span>
                <select id="device-type-filter"><option value="all">All types</option>${typeOptions}</select>
            </label>
            <button id="device-filter-clear" class="secondary-btn" type="button" ${hasFilters() ? "" : "disabled"}>Clear</button>
        </div>
    `;
}

function hasFilters() { return Boolean(filters.query || filters.room || filters.status !== "all" || filters.type !== "all"); }
function escapeAttr(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function escapeHtml(value) { return escapeAttr(value).replace(/>/g, "&gt;"); }

function renderListView(root) {
    root.innerHTML = `${filtersMarkup()}<div class="devices-results-meta"></div><div class="devices-list devices-page-grid"></div>`;
    bindFilters(root);
    renderFilteredList(root);
}

function renderFilteredList(root) {
    const list = root.querySelector(".devices-page-grid");
    if (!list) return;
    renderDeviceList(list, filteredDevices(), { filtered: hasFilters() });
    const meta = root.querySelector(".devices-results-meta");
    if (meta) {
        const total = appState.devices.length;
        const shown = filteredDevices().length;
        meta.textContent = hasFilters() ? `${shown} of ${total} devices` : `${total} device${total === 1 ? "" : "s"}`;
    }
    const clear = root.querySelector("#device-filter-clear");
    if (clear) clear.disabled = !hasFilters();
}

function bindFilters(root) {
    const search = root.querySelector("#device-search-input");
    const room = root.querySelector("#device-room-filter");
    const status = root.querySelector("#device-status-filter");
    const type = root.querySelector("#device-type-filter");
    const clear = root.querySelector("#device-filter-clear");
    search?.addEventListener("input", () => { filters.query = search.value; renderFilteredList(root); });
    room?.addEventListener("change", () => { filters.room = room.value; renderFilteredList(root); });
    status?.addEventListener("change", () => { filters.status = status.value; renderFilteredList(root); });
    type?.addEventListener("change", () => { filters.type = type.value; renderFilteredList(root); });
    clear?.addEventListener("click", () => {
        filters = { query: "", room: "", status: "all", type: "all" };
        renderListView(root);
        root.querySelector("#device-search-input")?.focus();
    });
}

function renderForRoute() {
    const root = container();
    if (!root || currentRoute.name !== "devices") return;
    if (!appState.hasLoadedOnce) {
        root.innerHTML = `<p class="page-muted">Loading...</p>`;
        renderedRouteKey = null;
        return;
    }
    if (!appState.apiOnline) {
        root.innerHTML = `<p class="page-muted">API offline.</p>`;
        renderedRouteKey = null;
        return;
    }
    if (currentRoute.param) {
        const device = appState.devices.find(d => d.hardware_id_hex === currentRoute.param);
        if (!device) {
            root.innerHTML = `<p class="page-muted">Device not found. <a href="#devices">Back to devices</a></p>`;
            renderedRouteKey = null;
            return;
        }
        renderDeviceDetail(root, device);
    } else {
        renderListView(root);
    }
    renderedRouteKey = routeKey(currentRoute);
}

export function initDevicesPage(onRouteChangeFn) {
    onRouteChangeFn((route) => {
        currentRoute = route;
        renderedRouteKey = null;
        renderForRoute();
    });
}

export function refreshDevicesPage(options = {}) {
    const source = options.source || "manual";
    if (currentRoute.name !== "devices") return;
    if (renderedRouteKey !== routeKey(currentRoute)) {
        renderForRoute();
        return;
    }
    if (currentRoute.param) {
        const device = appState.devices.find(d => d.hardware_id_hex === currentRoute.param);
        if (device) updateDeviceDetailValues(device);
        return;
    }
    const root = container();
    if (!root) return;
    if (source === "poll") {
        const list = root.querySelector(".devices-page-grid");
        if (list) {
            const visibleIds = new Set(filteredDevices().map(d => String(d.hardware_id_hex)));
            const currentIds = new Set([...list.querySelectorAll(".device-card[data-hardware-id]")].map(card => String(card.dataset.hardwareId)));
            if (visibleIds.size !== currentIds.size || [...visibleIds].some(id => !currentIds.has(id))) {
                renderFilteredList(root);
            } else {
                updateDeviceCards(list, filteredDevices());
            }
        }
    } else {
        renderFilteredList(root);
    }
}
