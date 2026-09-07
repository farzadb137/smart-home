import { appState, setPendingCommand, clearPendingCommand } from "./state.js";
import { UI_ICONS, CAPABILITY_ICONS } from "./icons.js";
import { renderDeviceCards, updateDeviceCards } from "./components/device-card.js";
import { renderRoomCards, updateRoomCards } from "./components/room-card.js";
import { formatCapabilityValue, getCapabilityLabel, getPrimaryCapability } from "./capabilities.js";
import { formatDeviceName } from "./utils.js";
import { assignDeviceToRoom, createRoom, deleteRoom, updateRoom, sendDeviceCommand } from "./api.js";

let currentRoute = { name: "overview", param: null };
let renderedRouteKey = null;

function roomIdOf(device) {
    return device.room_id ?? device.room?.id ?? device.area_id ?? null;
}

function roomNameOf(device) {
    return device.room_name ?? device.room?.name ?? device.area_name ?? null;
}

export function getRoomModels(state = appState) {
    const devices = Array.isArray(state.devices) ? state.devices : [];
    const sourceRooms = Array.isArray(state.rooms) ? state.rooms : [];
    const byId = new Map();

    sourceRooms.forEach((room, index) => {
        const id = room.id ?? room.room_id ?? room.slug ?? `room-${index}`;
        byId.set(String(id), {
            id: String(id),
            name: room.name || `Room ${index + 1}`,
            icon: room.icon || "room",
            order: Number.isFinite(room.sort_order) ? room.sort_order : (Number.isFinite(room.order) ? room.order : index),
            devices: [],
        });
    });

    devices.forEach(device => {
        const id = roomIdOf(device);
        if (id == null) return;
        const key = String(id);
        if (!byId.has(key)) {
            byId.set(key, {
                id: key,
                name: roomNameOf(device) || `Room ${key}`,
                icon: "room",
                order: 999,
                devices: [],
            });
        }
        byId.get(key).devices.push(device);
    });

    return [...byId.values()]
        .map(room => {
            const onlineCount = room.devices.filter(device => device.online).length;
            const temperatureDevice = room.devices.find(device => device.readings?.temperature?.value != null);
            const humidityDevice = room.devices.find(device => device.readings?.humidity?.value != null);
            const readings = [];
            if (temperatureDevice) readings.push(formatCapabilityValue("temperature", temperatureDevice.readings.temperature.value));
            if (humidityDevice) readings.push(formatCapabilityValue("humidity", humidityDevice.readings.humidity.value));
            return {
                ...room,
                deviceCount: room.devices.length,
                onlineCount,
                summary: readings.join(" · "),
            };
        })
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function unassignedDevices() {
    return (Array.isArray(appState.devices) ? appState.devices : []).filter(device => roomIdOf(device) == null);
}

function renderPageShell(container, roomCount, deviceCount) {
    const onlineCount = appState.devices.filter(device => device.online).length;
    const unassignedCount = unassignedDevices().length;
    container.innerHTML = `
        <section class="page-header rooms-page-header">
            <div>
                <p class="card-label">YOUR HOME</p>
                <h1>Rooms</h1>
                <p class="page-header-summary">Organize your home by physical space. Open a room to control its devices, inspect live readings, or move hardware between rooms.</p>
            </div>
            <div class="page-header-actions">
                <div class="page-header-metrics" aria-label="Room summary">
                    <span><strong>${roomCount}</strong> ${roomCount === 1 ? "room" : "rooms"}</span>
                    <span><strong>${onlineCount}</strong> online</span>
                    <span><strong>${unassignedCount}</strong> unassigned</span>
                </div>
                <button class="button button-primary" type="button" data-action="create-room">${UI_ICONS.plus} New room</button>
            </div>
        </section>
        <section class="card rooms-page-card">
            <div class="card-header rooms-section-header">
                <div><p class="card-label">SPACES</p><h2>Your rooms</h2><p>Choose a room to see its devices and live conditions.</p></div>
                <span class="detail-count">${roomCount}</span>
            </div>
            <div id="rooms-page-grid"></div>
        </section>
        <section class="card rooms-unassigned-card">
            <div class="card-header">
                <div><p class="card-label">NEEDS ORGANIZING</p><h2>Unassigned Devices</h2><p>Assign a room to keep your home organized.</p></div>
                <span class="detail-count" id="rooms-unassigned-count">0</span>
            </div>
            <div id="rooms-unassigned-list"></div>
        </section>
        <div id="rooms-form-host"></div>
    `;
    container.querySelector('[data-action="create-room"]')?.addEventListener("click", () => openRoomForm(container));
}

function setFormBusy(form, busy) {
    form.querySelectorAll("input, button").forEach(element => { element.disabled = busy; });
}

function renderEmptyPage(container) {
    renderPageShell(container, 0, appState.devices.length);
    renderRoomCards(container.querySelector("#rooms-page-grid"), [], {
        emptyTitle: "No rooms yet",
        emptyText: "Create your first room, then assign devices to it.",
    });
    renderUnassigned(container, unassignedDevices());
}

function renderUnassigned(container, devices) {
    const count = container.querySelector("#rooms-unassigned-count");
    const list = container.querySelector("#rooms-unassigned-list");
    if (count) count.textContent = String(devices.length);
    if (!list) return;

    if (!devices.length) {
        list.innerHTML = `<div class="rooms-unassigned-empty"><span>${UI_ICONS.check}</span><p>Every connected device has a room.</p></div>`;
        return;
    }

    const roomOptions = getRoomModels().map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join("");
    list.innerHTML = devices.map(device => {
        const capability = getPrimaryCapability(device);
        const value = capability ? formatCapabilityValue(capability, device.readings?.[capability]?.value) : "—";
        return `
            <div class="rooms-unassigned-row">
                <a class="rooms-unassigned-row-link" href="#devices/${encodeURIComponent(device.hardware_id_hex)}">
                    <span class="rooms-unassigned-row-main"><span class="rooms-unassigned-row-name">${escapeHtml(formatDeviceName(device.name))}</span><span class="rooms-unassigned-row-type">${escapeHtml(getCapabilityLabel(capability || device.type || "device"))}</span></span>
                    <span class="rooms-unassigned-row-value">${escapeHtml(value)}</span>
                </a>
                <label class="room-assignment-control"><span class="sr-only">Assign room for ${escapeHtml(formatDeviceName(device.name))}</span><select data-assign-device="${escapeHtml(device.hardware_id_hex)}"><option value="">Assign room…</option>${roomOptions}</select></label>
            </div>
        `;
    }).join("");

    list.querySelectorAll("select[data-assign-device]").forEach(select => {
        select.addEventListener("change", async () => {
            if (!select.value) return;
            await assignDevice(select.dataset.assignDevice, Number(select.value), select);
        });
    });
}

async function assignDevice(hardwareId, roomId, select) {
    select.disabled = true;
    try {
        const result = await assignDeviceToRoom(hardwareId, roomId);
        if (!result.success) throw new Error(result.error || "Assignment failed");
        const device = appState.devices.find(item => item.hardware_id_hex === hardwareId);
        if (device) {
            device.room_id = roomId;
            const room = getRoomModels().find(item => String(item.id) === String(roomId));
            device.room_name = room?.name || null;
        }
        renderForRoute(true);
    } catch (error) {
        select.disabled = false;
        select.value = "";
        window.alert(error.message);
    }
}

function getRoomMetrics(room) {
    const devices = room?.devices || [];
    const online = devices.filter(device => device.online).length;
    const offline = devices.length - online;
    const switches = devices.filter(device => Object.prototype.hasOwnProperty.call(device.readings || {}, "switch"));
    const activeSwitches = switches.filter(device => Boolean(device.readings?.switch?.value));
    const temperatureDevice = devices.find(device => device.readings?.temperature?.value != null);
    const humidityDevice = devices.find(device => device.readings?.humidity?.value != null);
    return {
        devices,
        online,
        offline,
        switches,
        activeSwitches,
        temperature: temperatureDevice ? formatCapabilityValue("temperature", temperatureDevice.readings.temperature.value) : "--",
        humidity: humidityDevice ? formatCapabilityValue("humidity", humidityDevice.readings.humidity.value) : "--",
    };
}

async function runRoomSwitchCommand(container, room, value) {
    const switches = (room?.devices || []).filter(device =>
        device.online && Object.prototype.hasOwnProperty.call(device.readings || {}, "switch")
    );
    const status = container.querySelector("[data-room-command-message]");
    const buttons = container.querySelectorAll("[data-room-command]");
    if (!switches.length) return;

    buttons.forEach(button => { button.disabled = true; });
    if (status) status.textContent = value ? "Turning switches on…" : "Turning switches off…";

    const results = await Promise.allSettled(switches.map(async device => {
        setPendingCommand(device.hardware_id_hex, "switch", value);
        try {
            const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", {
                name: "switch",
                value
            });
            if (!result.success) throw new Error(result.error || "Command failed");
            if (device.readings?.switch) device.readings.switch.value = value;
            return true;
        } catch (error) {
            clearPendingCommand(device.hardware_id_hex, "switch");
            throw error;
        }
    }));

    const failed = results.filter(result => result.status === "rejected").length;
    if (status) {
        status.textContent = failed
            ? `${switches.length - failed} switch${switches.length - failed === 1 ? "" : "es"} changed · ${failed} failed`
            : `${switches.length} switch${switches.length === 1 ? "" : "es"} ${value ? "turned on" : "turned off"}`;
    }
    buttons.forEach(button => { button.disabled = false; });
    patchRoomDetail(getRoomModels(appState).find(item => String(item.id) === String(room.id)));
}

function renderRoomDetail(container, room) {
    const metrics = getRoomMetrics(room);
    const devices = metrics.devices;
    const controls = devices.filter(device => Object.prototype.hasOwnProperty.call(device.readings || {}, "switch") || Object.prototype.hasOwnProperty.call(device.readings || {}, "brightness"));
    const sensors = devices.filter(device => !controls.includes(device));
    const availableDevices = appState.devices.filter(device => String(roomIdOf(device)) !== String(room.id));
    const roomIcon = UI_ICONS[room.icon] || UI_ICONS.room;
    container.innerHTML = `
        <section class="page-header rooms-page-header room-detail-header">
            <div class="room-detail-heading-block">
                <a class="back-link" href="#rooms">← All rooms</a>
                <div class="room-detail-title">
                    <span class="room-detail-icon" aria-hidden="true">${roomIcon}</span>
                    <div><p class="card-label">ROOM</p><h1>${escapeHtml(room.name)}</h1><p class="page-header-summary">${devices.length} ${devices.length === 1 ? "device" : "devices"} · ${metrics.online} online${metrics.offline ? ` · ${metrics.offline} offline` : ""}</p></div>
                </div>
            </div>
            <div class="page-header-actions room-detail-actions">
                <button class="button" type="button" data-action="edit-room">${UI_ICONS.edit} Edit room</button>
                <button class="button button-danger" type="button" data-action="delete-room">${UI_ICONS.trash} Delete</button>
            </div>
        </section>

        <section class="room-detail-overview">
            <div class="room-overview-grid">
                <div class="card room-overview-card"><span class="room-overview-icon">${UI_ICONS.devices}</span><div><span>Devices</span><strong>${devices.length}</strong><small>${metrics.online} online${metrics.offline ? ` · ${metrics.offline} offline` : ""}</small></div></div>
                <div class="card room-overview-card"><span class="room-overview-icon">${UI_ICONS.activity}</span><div><span>Active switches</span><strong>${metrics.activeSwitches.length}</strong><small>${metrics.switches.length ? `${metrics.switches.length} switch${metrics.switches.length === 1 ? "" : "es"} available` : "No switches"}</small></div></div>
                <div class="card room-overview-card"><span class="room-overview-icon">${CAPABILITY_ICONS.temperature}</span><div><span>Temperature</span><strong>${metrics.temperature}</strong><small>Latest room reading</small></div></div>
                <div class="card room-overview-card"><span class="room-overview-icon">${CAPABILITY_ICONS.humidity}</span><div><span>Humidity</span><strong>${metrics.humidity}</strong><small>Latest room reading</small></div></div>
            </div>
        </section>

        <section class="room-detail-main-grid">
            <section class="card room-quick-controls room-detail-panel">
                <div class="card-header"><div><p class="card-label">QUICK CONTROLS</p><h2>Room control</h2><p>Operate every online switch in this room together.</p></div><span class="detail-count">${metrics.switches.length}</span></div>
                <div class="room-quick-controls-actions">
                    <button class="button button-primary" type="button" data-room-command="on" ${metrics.switches.length ? "" : "disabled"}>Turn all on</button>
                    <button class="button" type="button" data-room-command="off" ${metrics.switches.length ? "" : "disabled"}>Turn all off</button>
                </div>
                <div class="room-control-state"><span class="room-control-state-dot"></span><span data-room-command-message>${metrics.switches.length ? `${metrics.activeSwitches.length}/${metrics.switches.length} switches on` : "No controllable switches"}</span></div>
            </section>
            <section class="card room-detail-panel room-environment-panel">
                <div class="card-header"><div><p class="card-label">ENVIRONMENT</p><h2>Room conditions</h2><p>Latest readings reported by devices in this room.</p></div></div>
                <div class="room-environment-values">
                    <div><span class="room-environment-icon">${CAPABILITY_ICONS.temperature}</span><div><small>Temperature</small><strong data-room-temperature>${metrics.temperature}</strong></div></div>
                    <div><span class="room-environment-icon">${CAPABILITY_ICONS.humidity}</span><div><small>Humidity</small><strong data-room-humidity>${metrics.humidity}</strong></div></div>
                </div>
            </section>
        </section>

        <section class="card room-detail-card room-devices-panel">
            <div class="card-header room-devices-header"><div><p class="card-label">DEVICES</p><h2>Devices in ${escapeHtml(room.name)}</h2><p>Use the controls directly, or select a device name for detailed settings.</p></div><span class="detail-count">${devices.length}</span></div>
            <div class="room-device-group" data-room-device-group="controls" ${controls.length ? "" : "hidden"}>
                <div class="room-device-group-heading"><div><h3>Controls</h3><span>Devices you can operate from this room</span></div><strong>${controls.length}</strong></div>
                <div id="room-detail-controls"></div>
            </div>
            <div class="room-device-group" data-room-device-group="sensors" ${sensors.length ? "" : "hidden"}>
                <div class="room-device-group-heading"><div><h3>Monitoring</h3><span>Live readings from sensors and other devices</span></div><strong>${sensors.length}</strong></div>
                <div id="room-detail-sensors"></div>
            </div>
            ${devices.length ? "" : `<div class="empty-state"><strong>No devices in this room.</strong><p>Assign a device below to start using this room.</p></div>`}
        </section>

        <section class="card room-assignment-card">
            <div class="card-header"><div><p class="card-label">ORGANIZE</p><h2>Add a device to this room</h2><p>Move an existing device here without changing its settings.</p></div></div>
            ${availableDevices.length ? `<form data-assign-form class="room-assignment-form"><select name="hardware_id" required><option value="">Choose a device…</option>${availableDevices.map(device => `<option value="${escapeHtml(device.hardware_id_hex)}">${escapeHtml(formatDeviceName(device.name))}${roomIdOf(device) != null ? ` · from ${escapeHtml(roomNameOf(device) || "another room")}` : " · unassigned"}</option>`).join("")}</select><button class="button button-primary" type="submit">Assign device</button><p class="form-message" data-room-message role="status"></p></form>` : `<div class="empty-state"><strong>All devices are already in this room.</strong><p>There are no other devices available to assign.</p></div>`}
        </section>
        <div id="rooms-form-host"></div>
    `;
    renderDeviceCards(container.querySelector("#room-detail-controls"), controls, { link: true });
    renderDeviceCards(container.querySelector("#room-detail-sensors"), sensors, { link: true });

    container.querySelectorAll("[data-room-command]").forEach(button => {
        button.addEventListener("click", () => runRoomSwitchCommand(container, room, button.dataset.roomCommand === "on" ? 1 : 0));
    });
    container.querySelector('[data-action="edit-room"]')?.addEventListener("click", () => openRoomForm(container, room));
    container.querySelector('[data-action="delete-room"]')?.addEventListener("click", () => removeRoom(container, room));
    container.querySelector("[data-assign-form]")?.addEventListener("submit", event => handleAssignmentSubmit(event, room));
}

async function handleAssignmentSubmit(event, room) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector("[data-room-message]");
    const hardwareId = new FormData(form).get("hardware_id");
    if (!hardwareId) return;
    setFormBusy(form, true);
    try {
        const result = await assignDeviceToRoom(hardwareId, Number(room.id));
        if (!result.success) throw new Error(result.error || "Assignment failed");
        const device = appState.devices.find(item => item.hardware_id_hex === hardwareId);
        if (device) { device.room_id = room.id; device.room_name = room.name; }
        renderForRoute(true);
    } catch (error) {
        message.textContent = error.message;
        setFormBusy(form, false);
    }
}

async function removeRoom(container, room) {
    const confirmed = window.confirm(`Delete “${room.name}”? Devices in this room will become unassigned.`);
    if (!confirmed) return;
    try {
        const result = await deleteRoom(room.id);
        if (!result.success) throw new Error(result.error || "Delete failed");
        appState.rooms = appState.rooms.filter(item => String(item.id) !== String(room.id));
        appState.devices.forEach(device => {
            if (String(roomIdOf(device)) === String(room.id)) { device.room_id = null; device.room_name = null; }
        });
        window.location.hash = "#rooms";
    } catch (error) {
        window.alert(error.message);
    }
}

function renderForRoute(force = false) {
    const container = document.getElementById("rooms-page");
    if (!container || currentRoute.name !== "rooms") return;
    if (!appState.hasLoadedOnce) {
        container.innerHTML = `<p class="page-loading">Loading rooms…</p>`;
        renderedRouteKey = null;
        return;
    }

    const rooms = getRoomModels(appState);
    const room = currentRoute.param ? rooms.find(item => item.id === decodeURIComponent(currentRoute.param)) : null;
    if (currentRoute.param && !room) {
        container.innerHTML = `<div class="card page-not-found"><strong>Room not found.</strong><p>The room may have been removed or is not available yet.</p><a class="back-link" href="#rooms">← Back to rooms</a></div>`;
        renderedRouteKey = `${currentRoute.name}/${currentRoute.param}`;
        return;
    }
    if (room) renderRoomDetail(container, room);
    else if (!rooms.length) renderEmptyPage(container);
    else { renderPageShell(container, rooms.length, appState.devices.length); renderRoomCards(container.querySelector("#rooms-page-grid"), rooms); renderUnassigned(container, unassignedDevices()); }
    renderedRouteKey = `${currentRoute.name}/${currentRoute.param || ""}`;
    if (force) renderedRouteKey = `${currentRoute.name}/${currentRoute.param || ""}`;
}

export function initRoomsPage(onRouteChangeFn) {
    onRouteChangeFn(route => { currentRoute = route; renderedRouteKey = null; renderForRoute(); });
}

function hasActiveRoomForm() {
    const container = document.getElementById("rooms-page");
    return Boolean(container?.querySelector("[data-room-form]"));
}

function patchRoomDetail(room) {
    const container = document.getElementById("rooms-page");
    if (!container || !room) return;

    const metrics = getRoomMetrics(room);
    const summary = container.querySelector(".room-detail-header .page-header-summary");
    if (summary) summary.textContent = `${metrics.devices.length} ${metrics.devices.length === 1 ? "device" : "devices"} · ${metrics.online} online${metrics.offline ? ` · ${metrics.offline} offline` : ""}`;

    const overviewCards = container.querySelectorAll(".room-overview-card");
    if (overviewCards.length >= 4) {
        overviewCards[0].querySelector("strong").textContent = String(metrics.devices.length);
        overviewCards[0].querySelector("small").textContent = `${metrics.online} online${metrics.offline ? ` · ${metrics.offline} offline` : ""}`;
        overviewCards[1].querySelector("strong").textContent = String(metrics.activeSwitches.length);
        overviewCards[1].querySelector("small").textContent = metrics.switches.length ? `${metrics.switches.length} switch${metrics.switches.length === 1 ? "" : "es"} available` : "No switches";
        overviewCards[2].querySelector("strong").textContent = metrics.temperature;
        overviewCards[3].querySelector("strong").textContent = metrics.humidity;
    }

    const controls = metrics.devices.filter(device => Object.prototype.hasOwnProperty.call(device.readings || {}, "switch") || Object.prototype.hasOwnProperty.call(device.readings || {}, "brightness"));
    const sensors = metrics.devices.filter(device => !controls.includes(device));
    updateDeviceCards(container.querySelector("#room-detail-controls"), controls);
    updateDeviceCards(container.querySelector("#room-detail-sensors"), sensors);
    const temp = container.querySelector("[data-room-temperature]");
    const humidity = container.querySelector("[data-room-humidity]");
    if (temp) temp.textContent = metrics.temperature;
    if (humidity) humidity.textContent = metrics.humidity;
    const commandMessage = container.querySelector("[data-room-command-message]");
    if (commandMessage && !container.querySelector("[data-room-command-message]")?.dataset.busy) commandMessage.textContent = metrics.switches.length ? `${metrics.activeSwitches.length}/${metrics.switches.length} switches on` : "No controllable switches";
}

function patchRoomsList(rooms) {
    const container = document.getElementById("rooms-page");
    if (!container) return;
    const grid = container.querySelector("#rooms-page-grid");
    const existingCards = [...container.querySelectorAll("#rooms-page-grid .room-card[data-room-id]")];
    const existingIds = existingCards.map(card => String(card.dataset.roomId));
    const nextIds = rooms.map(room => String(room.id));
    const structureChanged = existingIds.length !== nextIds.length || existingIds.some((id, index) => id !== nextIds[index]);
    if (structureChanged) {
        if (!hasActiveRoomForm()) {
            renderRoomCards(grid, rooms, { emptyTitle: "No rooms yet", emptyText: "Create your first room, then assign devices to it." });
        }
        return;
    }
    updateRoomCards(grid, rooms);
    const metrics = container.querySelector(".page-header-metrics");
    if (metrics) metrics.innerHTML = `<span><strong>${rooms.length}</strong> ${rooms.length === 1 ? "room" : "rooms"}</span><span><strong>${appState.devices.length}</strong> ${appState.devices.length === 1 ? "device" : "devices"}</span>`;
}

export function refreshRoomsPage(options = {}) {
    if (currentRoute.name !== "rooms") return;

    const source = options.source || "manual";
    if (source === "poll") {
        const rooms = getRoomModels(appState);
        if (currentRoute.param) {
            const room = rooms.find(item => item.id === decodeURIComponent(currentRoute.param));
            if (room) patchRoomDetail(room);
        } else if (!hasActiveRoomForm()) {
            patchRoomsList(rooms);
        }
        return;
    }

    if (hasActiveRoomForm()) return;
    renderForRoute();
}

export function renderHomeRoomsPreview(state = appState, options = {}) {
    const target = document.querySelector(".rooms-preview-content");
    if (!target) return;
    const rooms = getRoomModels(state).slice(0, 4);
    const existingCards = [...target.querySelectorAll(".room-card[data-room-id]")];
    const existingIds = existingCards.map(card => String(card.dataset.roomId));
    const nextIds = rooms.map(room => String(room.id));
    const structureChanged = existingIds.length !== nextIds.length || existingIds.some((id, index) => id !== nextIds[index]);
    if (options.source === "poll" && !structureChanged && rooms.length) {
        updateRoomCards(target, rooms);
        return;
    }
    renderRoomCards(target, rooms, { emptyTitle: "No rooms configured yet", emptyText: "Create rooms from the Rooms page, then assign devices to them.", quickControls: true });
}

function openRoomForm(container, room = null) {
    const host = container.querySelector("#rooms-form-host");
    if (!host) return;
    host.innerHTML = `
        <div class="room-form card">
            <div class="card-header"><div><p class="card-label">${room ? "EDIT ROOM" : "NEW ROOM"}</p><h2>${room ? "Rename room" : "Create a room"}</h2></div></div>
            <form data-room-form><label class="form-field"><span>Name</span><input name="name" maxlength="64" required value="${escapeHtml(room?.name || "")}" placeholder="e.g. Living Room" autofocus></label><div class="form-field room-icon-field"><span>Icon</span><div class="room-icon-options">${["room", "living", "kitchen", "bedroom", "office", "bathroom"].map(icon => `<label class="room-icon-option"><input type="radio" name="icon" value="${icon}" ${((room?.icon || "room") === icon) ? "checked" : ""}><span aria-hidden="true">${UI_ICONS[icon]}</span><small>${icon === "room" ? "Room" : icon[0].toUpperCase() + icon.slice(1)}</small></label>`).join("")}</div></div><div class="room-form-actions"><button class="button" type="button" data-action="cancel-room-form">Cancel</button><button class="button button-primary" type="submit">${room ? "Save changes" : "Create room"}</button></div><p class="form-message" data-room-message role="status"></p></form>
        </div>`;
    host.scrollIntoView({ behavior: "smooth", block: "nearest" });
    host.querySelector('[data-action="cancel-room-form"]')?.addEventListener("click", () => { host.innerHTML = ""; });
    host.querySelector("[data-room-form]")?.addEventListener("submit", async event => {
        event.preventDefault();
        const message = host.querySelector("[data-room-message]");
        const name = new FormData(event.currentTarget).get("name").trim();
        if (!name) return;
        setFormBusy(event.currentTarget, true);
        const icon = new FormData(event.currentTarget).get("icon") || "room";
        try {
            const result = room ? await updateRoom(room.id, { name, icon }) : await createRoom({ name, icon });
            if (result.room) {
                if (room) { const index = appState.rooms.findIndex(item => String(item.id) === String(room.id)); if (index >= 0) appState.rooms[index] = result.room; }
                else appState.rooms.push(result.room);
            }
            host.innerHTML = "";
            renderForRoute(true);
        } catch (error) { message.textContent = error.message; setFormBusy(event.currentTarget, false); }
    });
}

function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
