import { UI_ICONS } from "../icons.js";
import { sendDeviceCommand } from "../api.js";
import { setPendingCommand, clearPendingCommand } from "../state.js";

function roomIcon(room) {
    return UI_ICONS[room.icon] || UI_ICONS.room;
}

function roomHref(room) {
    return `#rooms/${encodeURIComponent(room.id)}`;
}

function switchDevices(room) {
    return (room?.devices || []).filter(device =>
        device.online && Object.prototype.hasOwnProperty.call(device.readings || {}, "switch")
    );
}

export function createRoomCard(room, options = {}) {
    const card = document.createElement("article");
    card.className = "room-card room-card-shell";
    card.dataset.roomId = String(room.id);

    const quickControls = options.quickControls === true;
    const switches = switchDevices(room);
    const activeSwitches = switches.filter(device => Boolean(device.readings?.switch?.value));

    card.innerHTML = `
        <div class="room-card-top">
            <span class="room-card-icon" aria-hidden="true">${roomIcon(room)}</span>
            <a class="room-card-arrow-link" href="${roomHref(room)}" aria-label="Open ${escapeHtml(room.name)}">→</a>
        </div>
        <a class="room-card-title-link" href="${roomHref(room)}"><h3>${escapeHtml(room.name)}</h3></a>
        <p>${room.deviceCount} ${room.deviceCount === 1 ? "device" : "devices"} · ${room.deviceCount ? `${room.onlineCount} online` : "No devices"}</p>
        ${room.summary ? `<span class="room-card-summary">${escapeHtml(room.summary)}</span>` : ""}
        ${quickControls && switches.length ? `
            <div class="room-card-controls" data-room-controls>
                <button class="button room-card-control-button ${activeSwitches.length ? "button-primary" : ""}" type="button" data-room-quick="on">On</button>
                <button class="button room-card-control-button" type="button" data-room-quick="off">Off</button>
                <span class="room-card-control-status" data-room-control-status role="status">${activeSwitches.length}/${switches.length} on</span>
            </div>
        ` : quickControls ? `<div class="room-card-no-controls">No online switches</div>` : ""}
    `;

    if (quickControls && switches.length) {
        card.querySelectorAll("[data-room-quick]").forEach(button => {
            button.addEventListener("click", async event => {
                event.preventDefault();
                event.stopPropagation();
                await runRoomQuickControl(card, room, button.dataset.roomQuick === "on");
            });
        });
    }

    return card;
}

export function renderRoomCards(container, rooms, { emptyTitle = "No rooms configured yet", emptyText = "Assign devices to rooms to organize your home by space.", quickControls = false } = {}) {
    if (!container) return;
    container.innerHTML = "";

    if (!rooms.length) {
        container.innerHTML = `
            <div class="empty-state room-empty-state">
                <span class="empty-state-icon" aria-hidden="true">${UI_ICONS.room}</span>
                <div>
                    <strong>${escapeHtml(emptyTitle)}</strong>
                    <p>${escapeHtml(emptyText)}</p>
                </div>
            </div>
        `;
        return;
    }

    const grid = document.createElement("div");
    grid.className = "rooms-grid";
    rooms.forEach(room => grid.append(createRoomCard(room, { quickControls })));
    container.append(grid);
}

export function updateRoomCards(container, rooms) {
    if (!container) return;
    const byId = new Map((rooms || []).map(room => [String(room.id), room]));
    container.querySelectorAll(".room-card[data-room-id]").forEach(card => {
        const room = byId.get(String(card.dataset.roomId));
        if (!room) return;
        const onlineLabel = room.deviceCount ? `${room.onlineCount} online` : "No devices";
        const title = card.querySelector("h3");
        const meta = card.querySelector("p");
        const icon = card.querySelector(".room-card-icon");
        const existingSummary = card.querySelector(".room-card-summary");
        if (title) title.textContent = room.name;
        const titleLink = card.querySelector(".room-card-title-link");
        const arrowLink = card.querySelector(".room-card-arrow-link");
        const href = roomHref(room);
        if (titleLink) titleLink.href = href;
        if (arrowLink) arrowLink.href = href;
        if (meta) meta.textContent = `${room.deviceCount} ${room.deviceCount === 1 ? "device" : "devices"} · ${onlineLabel}`;
        if (icon) icon.innerHTML = roomIcon(room);
        if (existingSummary && room.summary) existingSummary.textContent = room.summary;
        else if (existingSummary && !room.summary) existingSummary.remove();
        else if (!existingSummary && room.summary) {
            const summary = document.createElement("span");
            summary.className = "room-card-summary";
            summary.textContent = room.summary;
            card.append(summary);
        }
        updateRoomQuickControlState(card, room);
    });
}

async function runRoomQuickControl(card, room, value) {
    const devices = switchDevices(room);
    const buttons = card.querySelectorAll("[data-room-quick]");
    const status = card.querySelector("[data-room-control-status]");
    buttons.forEach(button => { button.disabled = true; });
    if (status) status.textContent = value ? "Turning on…" : "Turning off…";

    const results = await Promise.allSettled(devices.map(async device => {
        const hardwareId = device.hardware_id_hex;
        setPendingCommand(hardwareId, "switch", value ? 1 : 0);
        try {
            const result = await sendDeviceCommand(hardwareId, "set_capability", { name: "switch", value: value ? 1 : 0 });
            if (!result.success) throw new Error(result.error || "Command failed");
            if (device.readings?.switch) device.readings.switch.value = value ? 1 : 0;
            return true;
        } catch (error) {
            clearPendingCommand(hardwareId, "switch");
            throw error;
        }
    }));

    const failed = results.filter(result => result.status === "rejected").length;
    const nextRoom = { ...room, devices };
    const active = devices.filter(device => Boolean(device.readings?.switch?.value)).length;
    if (status) status.textContent = failed ? `${active}/${devices.length} on · ${failed} failed` : `${active}/${devices.length} on`;
    buttons.forEach(button => { button.disabled = false; });
    updateRoomQuickControlState(card, nextRoom);
}

function updateRoomQuickControlState(card, room) {
    const devices = switchDevices(room);
    const controls = card.querySelector("[data-room-controls]");
    if (!controls) return;
    const active = devices.filter(device => Boolean(device.readings?.switch?.value)).length;
    const status = controls.querySelector("[data-room-control-status]");
    if (status) status.textContent = `${active}/${devices.length} on`;
    const onButton = controls.querySelector('[data-room-quick="on"]');
    if (onButton) onButton.classList.toggle("button-primary", active > 0);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
