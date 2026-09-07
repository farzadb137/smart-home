import { appState } from "./state.js";
import { renderDeviceList } from "./components/device-list.js";
import { updateDeviceCards, updateFavoriteButtons } from "./components/device-card.js";
import { renderDeviceDetail, updateDeviceDetailValues } from "./components/device-detail.js";
import { getPrimaryCapability, getCapabilityLabel } from "./capabilities.js";
import { assignDeviceToRoom } from "./api.js";

let currentRoute = { name: "overview", param: null };
let renderedRouteKey = null;
let filters = { query: "", room: "", status: "all", type: "all" };
let selectedDeviceIds = new Set();
let bulkBusy = false;

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
        `<option value="${room.id}">${escapeHtml(room.name)}</option>`
    ).join("");
    const typeOptions = availableTypes().map(type =>
        `<option value="${escapeAttr(type)}">${escapeHtml(getCapabilityLabel(type))}</option>`
    ).join("");
    return `
        <div class="devices-page-header">
            <div>
                <span class="page-eyebrow">Device management</span>
                <h1>Devices</h1>
                <p>Control connected hardware, check live status, and keep every device organized.</p>
            </div>
            <a class="button button-primary devices-add-button" href="/add-device">Add device</a>
        </div>

        <div class="devices-summary" aria-label="Device summary">
            <div class="device-summary-item"><strong>${appState.devices.length}</strong><span>Total devices</span></div>
            <div class="device-summary-item"><strong>${appState.devices.filter(device => device.online).length}</strong><span>Online now</span></div>
            <div class="device-summary-item"><strong>${appState.devices.filter(device => device.room_id).length}</strong><span>Assigned to rooms</span></div>
        </div>

        <div class="devices-toolbar-shell">
            <div class="devices-toolbar-heading">
                <div>
                    <strong>Browse devices</strong>
                    <span>Search or narrow the list by room, status, or type.</span>
                </div>
                <span class="devices-live-indicator"><i></i> Live</span>
            </div>
            <div class="devices-toolbar" aria-label="Device filters">
                <label class="device-search">
                    <span class="sr-only">Search devices</span>
                    <span class="device-search-icon" aria-hidden="true">⌕</span>
                    <input id="device-search-input" type="search" value="${escapeAttr(filters.query)}" placeholder="Search devices…" autocomplete="off">
                </label>
                <label class="device-filter-select">
                    <span class="sr-only">Room</span>
                    <select id="device-room-filter"><option value="">All rooms</option>${roomOptions}</select>
                </label>
                <label class="device-filter-select">
                    <span class="sr-only">Status</span>
                    <select id="device-status-filter">
                        <option value="all">All status</option>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                    </select>
                </label>
                <label class="device-filter-select">
                    <span class="sr-only">Type</span>
                    <select id="device-type-filter"><option value="all">All types</option>${typeOptions}</select>
                </label>
                <button id="device-filter-clear" class="secondary-btn" type="button" ${hasFilters() ? "" : "disabled"}>Clear</button>
            </div>
        </div>

        <div class="devices-bulk-toolbar" aria-label="Bulk device actions">
            <div class="devices-bulk-left">
                <label class="devices-select-all"><input id="device-select-all" type="checkbox"><span>Select visible</span></label>
                <span id="device-selected-count" class="devices-selected-count">0 selected</span>
            </div>
            <div class="devices-bulk-right">
                <label class="device-bulk-room">
                    <span class="sr-only">Assign selected devices to room</span>
                    <select id="device-bulk-room"><option value="">Choose room…</option>${roomOptions}</select>
                </label>
                <button id="device-bulk-assign" class="primary-btn" type="button" disabled>Assign selected</button>
            </div>
        </div>
    `;
}

function hasFilters() { return Boolean(filters.query || filters.room || filters.status !== "all" || filters.type !== "all"); }
function escapeAttr(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
function escapeHtml(value) { return escapeAttr(value).replace(/>/g, "&gt;"); }

function visibleDevices() { return filteredDevices(); }

function cleanupSelection() {
    const valid = new Set(appState.devices.map(device => String(device.hardware_id_hex)));
    selectedDeviceIds = new Set([...selectedDeviceIds].filter(id => valid.has(id)));
}

function syncSelectionUI(root) {
    cleanupSelection();
    root.querySelectorAll("input[data-device-select]").forEach(input => {
        const card = input.closest(".device-card");
        input.checked = Boolean(card && selectedDeviceIds.has(String(card.dataset.hardwareId)));
    });
    const visible = visibleDevices();
    const visibleIds = visible.map(device => String(device.hardware_id_hex));
    const selectedVisible = visibleIds.filter(id => selectedDeviceIds.has(id));
    const count = root.querySelector("#device-selected-count");
    if (count) count.textContent = `${selectedDeviceIds.size} selected`;
    const selectAll = root.querySelector("#device-select-all");
    if (selectAll) {
        selectAll.checked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
        selectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
    }
    const room = root.querySelector("#device-bulk-room");
    const assign = root.querySelector("#device-bulk-assign");
    if (assign) assign.disabled = bulkBusy || selectedDeviceIds.size === 0 || !room?.value;
    if (room) room.disabled = bulkBusy || selectedDeviceIds.size === 0;
    if (selectAll) selectAll.disabled = bulkBusy || visibleIds.length === 0;
    root.querySelectorAll("[data-device-select]").forEach(input => input.disabled = bulkBusy);
}

async function bulkAssignSelected(root) {
    const room = root.querySelector("#device-bulk-room");
    const roomId = room?.value ? Number(room.value) : null;
    if (!roomId || selectedDeviceIds.size === 0 || bulkBusy) return;
    const ids = [...selectedDeviceIds];
    const target = appState.rooms.find(item => Number(item.id) === roomId);
    if (!target) return;
    bulkBusy = true;
    syncSelectionUI(root);
    const results = await Promise.allSettled(ids.map(id => assignDeviceToRoom(id, roomId)));
    let success = 0;
    results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value?.success !== false) {
            success += 1;
            const device = appState.devices.find(item => String(item.hardware_id_hex) === ids[index]);
            if (device) {
                device.room_id = target.id;
                device.room_name = target.name;
            }
        }
    });
    ids.forEach((id, index) => {
        if (results[index].status === "fulfilled" && results[index].value?.success !== false) selectedDeviceIds.delete(id);
    });
    bulkBusy = false;
    renderFilteredList(root);
    const message = root.querySelector("#device-bulk-message");
    if (message) message.textContent = success === ids.length ? `Assigned ${success} device${success === 1 ? "" : "s"} to ${target.name}.` : `Assigned ${success} of ${ids.length} devices. Check the remaining selections and try again.`;
}

function renderListView(root) {
    root.innerHTML = `${filtersMarkup()}<div class="devices-results-row"><div class="devices-results-title">Your devices</div><div class="devices-results-meta"></div></div><div id="device-bulk-message" class="devices-bulk-message" role="status" aria-live="polite"></div><div class="devices-list devices-page-grid"></div>`;
    bindFilters(root);
    bindBulkActions(root);
    renderFilteredList(root);
}

function renderFilteredList(root) {
    const list = root.querySelector(".devices-page-grid");
    if (!list) return;
    renderDeviceList(list, filteredDevices(), {
        filtered: hasFilters(),
        selectable: true,
        selectedIds: selectedDeviceIds,
        onSelect: (device, checked) => {
            const id = String(device.hardware_id_hex);
            if (checked) selectedDeviceIds.add(id); else selectedDeviceIds.delete(id);
            syncSelectionUI(root);
        },
        onFavoriteChange: () => {
            updateFavoriteButtons(root);
        }
    });
    const meta = root.querySelector(".devices-results-meta");
    if (meta) {
        const total = appState.devices.length;
        const shown = filteredDevices().length;
        meta.textContent = hasFilters() ? `${shown} of ${total} devices` : `${total} device${total === 1 ? "" : "s"}`;
    }
    const clear = root.querySelector("#device-filter-clear");
    if (clear) clear.disabled = !hasFilters();
    const message = root.querySelector("#device-bulk-message");
    if (message && bulkBusy) message.textContent = "Assigning devices…";
    syncSelectionUI(root);
}

function bindBulkActions(root) {
    const selectAll = root.querySelector("#device-select-all");
    const room = root.querySelector("#device-bulk-room");
    const assign = root.querySelector("#device-bulk-assign");
    selectAll?.addEventListener("change", () => {
        visibleDevices().forEach(device => {
            const id = String(device.hardware_id_hex);
            if (selectAll.checked) selectedDeviceIds.add(id); else selectedDeviceIds.delete(id);
        });
        syncSelectionUI(root);
        root.querySelectorAll("input[data-device-select]").forEach(input => {
            const card = input.closest(".device-card");
            input.checked = Boolean(card && selectedDeviceIds.has(String(card.dataset.hardwareId)));
        });
    });
    room?.addEventListener("change", () => syncSelectionUI(root));
    assign?.addEventListener("click", () => bulkAssignSelected(root));
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
                updateFavoriteButtons(list);
            }
        }
    } else {
        renderFilteredList(root);
    }
}
