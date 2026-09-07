import { renameDevice, uploadFirmware, sendDeviceCommand, assignDeviceToRoom } from "../api.js";
import { appState } from "../state.js";
import { fetchDeviceHistory, renderHistoryChart } from "../history.js";
import { formatDeviceName, formatRelativeTime } from "../utils.js";
import { CAPABILITY_ICONS, DEFAULT_ICON } from "../icons.js";
import { formatCapabilityValue, getCapabilityLabel, getPrimaryCapability } from "../capabilities.js";
import { getPendingCommand, setPendingCommand, clearPendingCommand } from "../state.js";

let activeChart = null;

function capabilityLabel(name) {
    return getCapabilityLabel(name);
}

function primaryValue(device, capability) {
    const reading = device.readings?.[capability];
    if (!reading) return "--";
    return formatCapabilityValue(capability, reading.value);
}

export function renderDeviceDetail(root, device) {
    const capabilities = Object.entries(device.readings || {});
    const primaryCapability = getPrimaryCapability(device);
    const icon = primaryCapability ? (CAPABILITY_ICONS[primaryCapability] || DEFAULT_ICON) : DEFAULT_ICON;
    const name = formatDeviceName(device.name);
    const type = capabilityLabel(primaryCapability || device.type || "device");

    root.innerHTML = `
        <div class="device-detail">
            <a href="#devices" class="back-link">← All devices</a>

            <section class="device-detail-hero card">
                <div class="device-detail-hero-main">
                    <div class="device-detail-icon" aria-hidden="true">${icon}</div>
                    <div class="device-detail-heading">
                        <div class="device-detail-eyebrow">${type}</div>
                        <h2 id="detail-device-name">${name}</h2>
                        <div class="device-detail-meta">
                            <span class="detail-status-pill ${device.online ? "online" : "offline"}">
                                <span class="device-card-status-dot ${device.online ? "online" : "offline"}"></span>
                                <span id="detail-status-text">${device.online ? "Online" : "Offline"}</span>
                            </span>
                            ${device.parent_name ? `<span>via ${formatDeviceName(device.parent_name)}</span>` : ""}
                        </div>
                    </div>
                </div>
                <div class="device-detail-primary">
                    <span class="device-detail-primary-label">Current value</span>
                    <strong id="detail-primary-value">${primaryValue(device, primaryCapability)}</strong>
                    ${primaryCapability === "switch" ? `
                        <label class="device-toggle device-detail-toggle" title="${device.online ? "Toggle device" : "Device offline"}">
                            <input id="detail-switch-toggle" type="checkbox" ${device.readings?.switch?.value ? "checked" : ""} ${device.online ? "" : "disabled"} aria-label="Toggle ${name}">
                            <span class="device-toggle-slider"></span>
                        </label>
                    ` : ""}
                </div>
            </section>

            <section class="device-detail-grid">
                <div class="card device-detail-capabilities-card">
                    <div class="detail-card-heading">
                        <div>
                            <p class="card-label">Live data</p>
                            <h3 class="detail-section-title">Capabilities</h3>
                        </div>
                        <span class="detail-count">${capabilities.length}</span>
                    </div>
                    <div class="device-detail-capabilities" id="detail-capabilities"></div>
                </div>

                <div class="card device-detail-info-card">
                    <div class="detail-card-heading">
                        <div>
                            <p class="card-label">Identity</p>
                            <h3 class="detail-section-title">Device info</h3>
                        </div>
                    </div>
                    <div class="device-info-list">
                        <div class="detail"><span class="detail-label">Hardware ID</span><span class="detail-value">${device.hardware_id_hex || "--"}</span></div>
                        ${device.parent_name ? `<div class="detail"><span class="detail-label">Bridge</span><span class="detail-value">${formatDeviceName(device.parent_name)}</span></div>` : ""}
                        <div class="detail"><span class="detail-label">Model</span><span class="detail-value">${device.model || "--"}</span></div>
                        <div class="detail"><span class="detail-label">Room</span><span class="detail-value" id="detail-room-name">${device.room_name || "Unassigned"}</span></div>
                        <div class="detail"><span class="detail-label">Firmware</span><span class="detail-value">${device.firmware || "--"}</span></div>
                        <div class="detail"><span class="detail-label">First seen</span><span class="detail-value">${formatRelativeTime(device.first_seen)}</span></div>
                    </div>
                </div>
            </section>

            <section class="card device-detail-history-card">
                <div class="detail-card-heading detail-card-heading-wrap">
                    <div>
                        <p class="card-label">Trends</p>
                        <h3 class="detail-section-title">History</h3>
                    </div>
                    <div id="detail-capability-tabs" class="history-range-buttons"></div>
                </div>
                <div class="detail-history-toolbar" id="detail-range-buttons">
                    <button class="range-btn active" data-range="24h">24h</button>
                    <button class="range-btn" data-range="7d">7d</button>
                    <button class="range-btn" data-range="30d">30d</button>
                </div>
                <div class="history-chart-wrap">
                    <canvas id="detail-history-canvas"></canvas>
                </div>
            </section>

            <section class="device-detail-grid device-detail-secondary-grid">
                <div class="card">
                    <div class="detail-card-heading">
                        <div>
                            <p class="card-label">Configuration</p>
                            <h3 class="detail-section-title">Device name</h3>
                        </div>
                    </div>
                    <div class="detail-rename-row">
                        <input type="text" id="rename-input" value="${device.name || ""}" maxlength="31" aria-label="Device name">
                        <button id="rename-btn" class="detail-btn">Save</button>
                    </div>
                    <div id="rename-status" class="detail-status-line"></div>
                    <div class="detail-setting-row">
                        <label for="detail-room-select">Room</label>
                        <select id="detail-room-select">
                            <option value="">Unassigned</option>
                            ${(Array.isArray(appState.rooms) ? appState.rooms : []).map(room => `<option value="${room.id}" ${String(room.id) === String(device.room_id ?? "") ? "selected" : ""}>${escapeHtml(room.name || "Room")}</option>`).join("")}
                        </select>
                        <button id="detail-room-save" class="detail-btn" type="button">Save room</button>
                    </div>
                    <div id="room-status" class="detail-status-line"></div>
                </div>

                <div class="card">
                    <div class="detail-card-heading">
                        <div>
                            <p class="card-label">Maintenance</p>
                            <h3 class="detail-section-title">Firmware</h3>
                        </div>
                    </div>
                    <p class="detail-help-text">Upload a .bin firmware image. Version and checksum are read from the file automatically.</p>
                    <input type="file" id="firmware-file" accept=".bin" aria-label="Firmware image">
                    <button id="firmware-upload-btn" class="detail-btn" style="margin-top:10px;">Upload & Install</button>
                    <div id="firmware-status" class="detail-status-line"></div>
                </div>
            </section>
        </div>
    `;

    renderCapabilityCards(device, capabilities);
    wirePrimarySwitch(device);
    wireRename(device);
    wireRoomAssignment(device);
    wireFirmwareUpload(device);
    wireHistory(device, capabilities);
}

function renderCapabilityCards(device, capabilities) {
    const container = document.getElementById("detail-capabilities");
    if (!container) return;

    if (capabilities.length === 0) {
        container.innerHTML = `<div class="empty-state detail-empty-state"><strong>No capabilities reported</strong><p>The device is connected, but it has not reported any readings yet.</p></div>`;
        return;
    }

    capabilities.forEach(([name, reading]) => {
        const icon = CAPABILITY_ICONS[name] || DEFAULT_ICON;
        const card = document.createElement("div");
        card.className = `detail-capability-card detail-capability-card--${name}`;
        card.innerHTML = `
            <div class="detail-capability-icon">${icon}</div>
            <div class="detail-capability-copy">
                <span>${capabilityLabel(name)}</span>
                <strong id="cap-value-${name}">${formatCapabilityValue(name, reading.value)}</strong>
            </div>
        `;

        const control = createCapabilityControl(device, name, reading.value);
        if (control) card.append(control);
        container.append(card);
    });
}

function createCapabilityControl(device, name, value) {
    if (!device.online) return null;

    if (name === "switch") {
        const wrapper = document.createElement("label");
        wrapper.className = "device-toggle detail-capability-control";
        wrapper.title = "Toggle device";
        wrapper.innerHTML = `<input type="checkbox" ${value ? "checked" : ""} aria-label="Toggle ${formatDeviceName(device.name)}"><span class="device-toggle-slider"></span>`;
        wrapper.querySelector("input").addEventListener("change", event => sendCapabilityValue(device, name, event.target.checked ? 1 : 0, event.target));
        return wrapper;
    }

    if (name === "brightness") {
        const wrapper = document.createElement("label");
        wrapper.className = "detail-capability-range";
        const numericValue = Math.max(0, Math.min(100, Number(value ?? 0)));
        wrapper.innerHTML = `<input type="range" min="0" max="100" step="1" value="${numericValue}" aria-label="Brightness"><span>${numericValue}%</span>`;
        const input = wrapper.querySelector("input");
        const output = wrapper.querySelector("span");
        let previous = numericValue;
        input.addEventListener("input", () => { output.textContent = `${input.value}%`; });
        input.addEventListener("change", async () => {
            const next = Number(input.value);
            input.disabled = true;
            const ok = await sendCapabilityValue(device, name, next, input);
            if (ok) previous = next;
            else { input.value = String(previous); output.textContent = `${previous}%`; }
            input.disabled = false;
        });
        return wrapper;
    }

    if (name === "target_temperature") {
        const wrapper = document.createElement("div");
        wrapper.className = "detail-capability-stepper";
        wrapper.innerHTML = `<button type="button" aria-label="Decrease target temperature">−</button><span>${formatCapabilityValue(name, value)}</span><button type="button" aria-label="Increase target temperature">+</button>`;
        const output = wrapper.querySelector("span");
        wrapper.querySelectorAll("button").forEach(button => {
            button.addEventListener("click", async () => {
                const current = Number(device.readings?.[name]?.value ?? value ?? 20);
                const next = Math.round((current + (button.textContent === "+" ? 0.5 : -0.5)) * 10) / 10;
                button.disabled = true;
                const ok = await sendCapabilityValue(device, name, next, button);
                if (ok) output.textContent = formatCapabilityValue(name, next);
                button.disabled = false;
            });
        });
        return wrapper;
    }

    return null;
}

async function sendCapabilityValue(device, name, value, source) {
    if (source) source.disabled = true;
    setPendingCommand(device.hardware_id_hex, name, value);
    try {
        const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", { name, value });
        if (!result.success) {
            clearPendingCommand(device.hardware_id_hex, name);
            return false;
        }
        if (device.readings?.[name]) device.readings[name].value = value;
        const valueEl = document.getElementById(`cap-value-${name}`);
        if (valueEl) valueEl.textContent = formatCapabilityValue(name, value);
        if (name === "switch") {
            const primary = document.getElementById("detail-primary-value");
            if (primary) primary.textContent = formatCapabilityValue(name, value);
        }
        return true;
    } catch (error) {
        clearPendingCommand(device.hardware_id_hex, name);
        console.error("Command failed:", error);
        return false;
    } finally {
        if (source) source.disabled = false;
    }
}

function wirePrimarySwitch(device) {
    const toggle = document.getElementById("detail-switch-toggle");
    if (!toggle) return;

    toggle.addEventListener("change", async event => {
        const newValue = event.target.checked ? 1 : 0;
        setPendingCommand(device.hardware_id_hex, "switch", newValue);
        event.target.disabled = true;
        try {
            const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", { name: "switch", value: newValue });
            if (result.success) {
                if (device.readings?.switch) device.readings.switch.value = newValue;
                const value = document.getElementById("detail-primary-value");
                if (value) value.textContent = formatCapabilityValue("switch", newValue);
            } else {
                clearPendingCommand(device.hardware_id_hex, "switch");
                event.target.checked = !event.target.checked;
            }
        } catch (error) {
            clearPendingCommand(device.hardware_id_hex, "switch");
            event.target.checked = !event.target.checked;
            console.error("Command failed:", error);
        } finally {
            event.target.disabled = false;
        }
    });
}


function wireRoomAssignment(device) {
    const select = document.getElementById("detail-room-select");
    const button = document.getElementById("detail-room-save");
    const status = document.getElementById("room-status");
    if (!select || !button) return;

    button.addEventListener("click", async () => {
        button.disabled = true;
        if (status) status.textContent = "Saving room…";
        try {
            const roomId = select.value ? Number(select.value) : null;
            const result = await assignDeviceToRoom(device.hardware_id_hex, roomId);
            if (!result.success) throw new Error(result.error || "Room assignment failed");
            device.room_id = roomId;
            const room = (Array.isArray(appState.rooms) ? appState.rooms : []).find(item => String(item.id) === String(roomId));
            device.room_name = room?.name || null;
            const roomName = document.getElementById("detail-room-name");
            if (roomName) roomName.textContent = room?.name || "Unassigned";
            if (status) status.textContent = room?.name ? `Assigned to ${room.name}.` : "Device is now unassigned.";
        } catch (error) {
            if (status) status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
}

function wireRename(device) {
    const button = document.getElementById("rename-btn");
    const input = document.getElementById("rename-input");
    const status = document.getElementById("rename-status");

    button.addEventListener("click", async () => {
        const newName = input.value.trim();
        if (!newName) return;
        status.textContent = "Saving...";
        status.style.color = "var(--color-text-muted)";
        try {
            await renameDevice(device.hardware_id_hex, newName);
            status.textContent = "Saved — the device will confirm on its next update.";
            status.style.color = "var(--color-success)";
            document.getElementById("detail-device-name").textContent = newName;
        } catch (error) {
            status.textContent = error.message;
            status.style.color = "var(--color-danger)";
        }
    });
}

function wireFirmwareUpload(device) {
    const button = document.getElementById("firmware-upload-btn");
    const fileInput = document.getElementById("firmware-file");
    const status = document.getElementById("firmware-status");

    button.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) {
            status.textContent = "Choose a .bin file first";
            status.style.color = "var(--color-danger)";
            return;
        }
        button.disabled = true;
        status.textContent = "Uploading and verifying...";
        status.style.color = "var(--color-text-muted)";
        try {
            const result = await uploadFirmware(device.hardware_id_hex, file);
            status.textContent = `Update to ${result.data?.version || "new version"} started — device will restart shortly.`;
            status.style.color = "var(--color-success)";
        } catch (error) {
            status.textContent = error.message;
            status.style.color = "var(--color-danger)";
        } finally {
            button.disabled = false;
        }
    });
}

function wireHistory(device, capabilities) {
    const tabsContainer = document.getElementById("detail-capability-tabs");
    if (!tabsContainer) return;

    if (capabilities.length === 0) {
        document.querySelector(".history-chart-wrap").innerHTML = `<p class="detail-history-empty">No history available.</p>`;
        return;
    }

    let activeCapability = capabilities[0][0];
    let activeRange = "24h";

    function renderTabs() {
        tabsContainer.innerHTML = "";
        capabilities.forEach(([name]) => {
            const tab = document.createElement("button");
            tab.className = "range-btn" + (name === activeCapability ? " active" : "");
            tab.textContent = capabilityLabel(name);
            tab.addEventListener("click", () => {
                activeCapability = name;
                renderTabs();
                loadChart();
            });
            tabsContainer.append(tab);
        });
    }

    document.querySelectorAll("#detail-range-buttons .range-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#detail-range-buttons .range-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeRange = btn.dataset.range;
            loadChart();
        });
    });

    async function loadChart() {
        const canvas = document.getElementById("detail-history-canvas");
        try {
            const points = await fetchDeviceHistory(device.hardware_id_hex, activeCapability, activeRange);
            if (activeChart) {
                activeChart.destroy();
                activeChart = null;
            }
            activeChart = renderHistoryChart(canvas, points, activeRange);
        } catch (error) {
            console.error("Failed to load history:", error);
        }
    }

    renderTabs();
    loadChart();
}

export function updateDeviceDetailValues(device) {
    const statusText = document.getElementById("detail-status-text");
    const statusPill = statusText?.closest(".detail-status-pill");
    if (statusText) statusText.textContent = device.online ? "Online" : "Offline";
    if (statusPill) statusPill.className = `detail-status-pill ${device.online ? "online" : "offline"}`;

    Object.entries(device.readings || {}).forEach(([name, reading]) => {
        const value = formatCapabilityValue(name, reading.value);
        const el = document.getElementById(`cap-value-${name}`);
        if (el) el.textContent = value;
        if (name === getPrimaryCapability(device)) {
            const primary = document.getElementById("detail-primary-value");
            if (primary) primary.textContent = value;
        }
        if (name === "switch") {
            const toggle = document.getElementById("detail-switch-toggle");
            const pending = getPendingCommand(device.hardware_id_hex, "switch");
            const telemetryValue = Boolean(reading.value);
            if (pending && telemetryValue === Boolean(pending.value)) clearPendingCommand(device.hardware_id_hex, "switch");
            const desired = getPendingCommand(device.hardware_id_hex, "switch");
            if (toggle && document.activeElement !== toggle) toggle.checked = desired ? Boolean(desired.value) : telemetryValue;
            if (toggle) toggle.disabled = !device.online || Boolean(desired);
        }
    });
}
