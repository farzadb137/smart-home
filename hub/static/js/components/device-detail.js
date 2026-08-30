import { renameDevice, uploadFirmware, sendDeviceCommand } from "../api.js";
import { fetchDeviceHistory, renderHistoryChart } from "../history.js";
import { formatDeviceName, formatRelativeTime } from "../utils.js";
import { CAPABILITY_ICONS, DEFAULT_ICON } from "../icons.js";

const CAPABILITY_FORMATTERS = {
    temperature: (value) => value == null ? "--" : `${Number(value).toFixed(1)} °C`,
    switch: (value) => value ? "On" : "Off",
    contact: (value) => value ? "Open" : "Closed",
};

function formatValue(capability, value) {
    const formatter = CAPABILITY_FORMATTERS[capability];
    return formatter ? formatter(value) : (value == null ? "--" : String(value));
}

let activeChart = null;

export function renderDeviceDetail(root, device) {
    const capabilities = Object.entries(device.readings || {});

    root.innerHTML = `
        <div class="device-detail">
            <a href="#devices" class="back-link">&larr; All devices</a>

            <div class="card device-detail-header">
                <div>
                    <p class="card-label">${device.type ? device.type.toUpperCase() : "DEVICE"}</p>
                    <h2 id="detail-device-name">${formatDeviceName(device.name)}</h2>
                </div>
                <span class="status-badge">
                    <span class="status-dot" id="detail-status-dot" style="background-color:${device.online ? "var(--color-success)" : "var(--color-danger)"}"></span>
                    <span id="detail-status-text">${device.online ? "Online" : "Offline"}</span>
                </span>
            </div>

            <div class="card">
                <h3 class="detail-section-title">Rename device</h3>
                <div class="detail-rename-row">
                    <input type="text" id="rename-input" value="${device.name}" maxlength="31">
                    <button id="rename-btn" class="detail-btn">Save</button>
                </div>
                <div id="rename-status" class="detail-status-line"></div>
            </div>

            <div class="card">
                <h3 class="detail-section-title">Capabilities</h3>
                <div class="devices-list" id="detail-capabilities"></div>
            </div>

            <div class="card">
                <h3 class="detail-section-title">History</h3>
                <div id="detail-capability-tabs" class="history-range-buttons"></div>
                <div class="history-range-buttons" id="detail-range-buttons">
                    <button class="range-btn active" data-range="24h">24h</button>
                    <button class="range-btn" data-range="7d">7d</button>
                    <button class="range-btn" data-range="30d">30d</button>
                </div>
                <div class="history-chart-wrap">
                    <canvas id="detail-history-canvas"></canvas>
                </div>
            </div>

            <div class="card">
                <h3 class="detail-section-title">Device info</h3>
                <div class="climate-details" style="border-top:none;padding-top:0;">
                    <div class="detail"><span class="detail-label">Hardware ID</span><span class="detail-value">${device.hardware_id_hex}</span></div>
                    <div class="detail"><span class="detail-label">Model</span><span class="detail-value">${device.model || "--"}</span></div>
                    <div class="detail"><span class="detail-label">Firmware</span><span class="detail-value">${device.firmware || "--"}</span></div>
                    <div class="detail"><span class="detail-label">First seen</span><span class="detail-value">${formatRelativeTime(device.first_seen)}</span></div>
                </div>
            </div>

            <div class="card">
                <h3 class="detail-section-title">Firmware update</h3>
                <p class="detail-help-text">Upload a .bin firmware image - version and checksum are read from the file automatically.</p>
                <input type="file" id="firmware-file" accept=".bin">
                <button id="firmware-upload-btn" class="detail-btn" style="margin-top:10px;">Upload & Install</button>
                <div id="firmware-status" class="detail-status-line"></div>
            </div>
        </div>
    `;

    renderCapabilityCards(device, capabilities);
    wireRename(device);
    wireFirmwareUpload(device);
    wireHistory(device, capabilities);
}

function renderCapabilityCards(device, capabilities) {
    const container = document.getElementById("detail-capabilities");

    if (capabilities.length === 0) {
        container.innerHTML = `<p style="color:var(--color-text-muted);">No capabilities reported yet.</p>`;
        return;
    }

    capabilities.forEach(([name, reading]) => {
        const icon = CAPABILITY_ICONS[name] || DEFAULT_ICON;
        const card = document.createElement("div");
        card.classList.add("device-card");
        card.innerHTML = `
            <div class="device-card-top">
                <span class="device-card-icon">${icon}</span>
            </div>
            <strong class="device-card-name">${name}</strong>
            <div class="device-card-value" id="cap-value-${name}">${formatValue(name, reading.value)}</div>
        `;

        if (name === "switch") {
            const toggle = document.createElement("label");
            toggle.className = "device-toggle";
            toggle.innerHTML = `<input type="checkbox" ${reading.value ? "checked" : ""} ${device.online ? "" : "disabled"}><span class="device-toggle-slider"></span>`;
            toggle.querySelector("input").addEventListener("change", async (event) => {
                const newValue = event.target.checked ? 1 : 0;
                event.target.disabled = true;
                try {
                    const result = await sendDeviceCommand(device.hardware_id_hex, "set_capability", { name: "switch", value: newValue });
                    if (!result.success)
                        event.target.checked = !event.target.checked;
                } catch (error) {
                    event.target.checked = !event.target.checked;
                } finally {
                    event.target.disabled = false;
                }
            });
            card.append(toggle);
        }

        container.append(card);
    });
}

function wireRename(device) {
    const button = document.getElementById("rename-btn");
    const input = document.getElementById("rename-input");
    const status = document.getElementById("rename-status");

    button.addEventListener("click", async () => {
        const newName = input.value.trim();
        if (!newName)
            return;
        status.textContent = "Saving...";
        status.style.color = "var(--color-text-muted)";
        try {
            await renameDevice(device.hardware_id_hex, newName);
            status.textContent = "Saved - the device will confirm on its next update.";
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
            status.textContent = `Update to ${result.data?.version || "new version"} started - device will restart shortly.`;
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

    if (capabilities.length === 0) {
        document.querySelector(".history-chart-wrap").innerHTML = `<p style="color:var(--color-text-muted)">No history available.</p>`;
        return;
    }

    let activeCapability = capabilities[0][0];
    let activeRange = "24h";

    function renderTabs() {
        tabsContainer.innerHTML = "";
        capabilities.forEach(([name]) => {
            const tab = document.createElement("button");
            tab.className = "range-btn" + (name === activeCapability ? " active" : "");
            tab.textContent = name;
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

/**
 * Lightweight periodic refresh - patches online status + non-switch
 * capability values in place. Deliberately does NOT touch the switch
 * toggle (that has its own optimistic-update handler, same pattern as
 * the overview dashboard's toggle, to avoid reintroducing the stale-
 * value revert bug) and does NOT rebuild the chart (would reset it on
 * every 30s poll for no reason).
 */
export function updateDeviceDetailValues(device) {
    const statusDot = document.getElementById("detail-status-dot");
    const statusText = document.getElementById("detail-status-text");
    if (statusDot && statusText) {
        statusDot.style.backgroundColor = device.online ? "var(--color-success)" : "var(--color-danger)";
        statusText.textContent = device.online ? "Online" : "Offline";
    }

    Object.entries(device.readings || {}).forEach(([name, reading]) => {
        if (name === "switch")
            return;
        const el = document.getElementById(`cap-value-${name}`);
        if (el)
            el.textContent = formatValue(name, reading.value);
    });
}