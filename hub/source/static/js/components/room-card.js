import { UI_ICONS } from "../icons.js";
import { sendDeviceCommand } from "../api.js";
import { setPendingCommand, clearPendingCommand } from "../state.js";
import { formatDeviceName } from "../utils.js"

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
    const offlineCount = Math.max(0, (room.deviceCount || 0) - (room.onlineCount || 0));
    const previewDevices = (room.devices || []).slice(0, 3);

    card.innerHTML = `
        <div class="room-card-top">
            <a class="room-card-icon-link" href="${roomHref(room)}" aria-label="Open ${escapeHtml(room.name)}">
                <span class="room-card-icon" aria-hidden="true">${roomIcon(room)}</span>
            </a>
            <div class="room-card-top-right">
                <span class="room-status-pill ${offlineCount ? "is-warning" : "is-online"}"><i></i>${offlineCount ? `${offlineCount} offline` : "All online"}</span>
                <a class="room-card-arrow-link" href="${roomHref(room)}" aria-label="Open ${escapeHtml(room.name)}">→</a>
            </div>
        </div>
        <a class="room-card-title-link" href="${roomHref(room)}"><h3>${escapeHtml(room.name)}</h3></a>
        <p class="room-card-meta">${room.deviceCount} ${room.deviceCount === 1 ? "device" : "devices"} · ${room.onlineCount} online</p>
        ${room.summary ? `<span class="room-card-summary">${escapeHtml(room.summary)}</span>` : `<span class="room-card-summary room-card-summary-muted">No environmental readings</span>`}
        <div class="room-card-device-preview">
            ${previewDevices.length ? previewDevices.map(device => `<span class="room-device-chip">${escapeHtml(formatDeviceName(device.name))}</span>`).join("") : `<span class="room-device-chip room-device-chip-muted">No devices assigned</span>`}
            ${room.deviceCount > previewDevices.length ? `<span class="room-device-chip room-device-chip-more">+${room.deviceCount - previewDevices.length}</span>` : ""}
        </div>
        ${quickControls && switches.length ? `
            <div class="room-card-controls" data-room-controls>
                <button class="button room-card-control-button ${activeSwitches.length ? "button-primary" : ""}" type="button" data-room-quick="on">On</button>
                <button class="button room-card-control-button" type="button" data-room-quick="off">Off</button>
                <span class="room-card-control-status" data-room-control-status role="status">${activeSwitches.length}/${switches.length} on</span>
            </div>
        ` : quickControls ? `<div class="room-card-no-controls">No online switches</div>` : `<a class="room-card-open-link" href="${roomHref(room)}">Open room <span>→</span></a>`}
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
        const href = roomHref(room);
        if (title) title.textContent = room.name;
        card.querySelectorAll(".room-card-title-link, .room-card-arrow-link, .room-card-icon-link, .room-card-open-link").forEach(link => { link.href = href; });
        if (meta) meta.textContent = `${room.deviceCount} ${room.deviceCount === 1 ? "device" : "devices"} · ${onlineLabel}`;
        if (icon) icon.innerHTML = roomIcon(room);
        const statusPill = card.querySelector(".room-status-pill");
        if (statusPill) {
            const offlineCount = Math.max(0, (room.deviceCount || 0) - (room.onlineCount || 0));
            statusPill.classList.toggle("is-warning", offlineCount > 0);
            statusPill.classList.toggle("is-online", offlineCount === 0);
            statusPill.innerHTML = `<i></i>${offlineCount ? `${offlineCount} offline` : "All online"}`;
        }
        if (existingSummary && room.summary) existingSummary.textContent = room.summary;
        else if (existingSummary && !room.summary) existingSummary.textContent = "No environmental readings";
        const preview = card.querySelector(".room-card-device-preview");
        if (preview) {
            const previewDevices = (room.devices || []).slice(0, 3);
            preview.innerHTML = previewDevices.length
                ? previewDevices.map(device => `<span class="room-device-chip">${escapeHtml(formatDeviceName(device.name))}</span>`).join("")
                : `<span class="room-device-chip room-device-chip-muted">No devices assigned</span>`;
            if (room.deviceCount > previewDevices.length) {
                preview.insertAdjacentHTML("beforeend", `<span class="room-device-chip room-device-chip-more">+${room.deviceCount - previewDevices.length}</span>`);
            }
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
