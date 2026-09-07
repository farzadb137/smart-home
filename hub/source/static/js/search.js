import { appState } from "./state.js";
import { formatDeviceName } from "./utils.js";
import { CAPABILITY_ICONS, DEFAULT_ICON, UI_ICONS } from "./icons.js";
import { getCapabilityLabel, getPrimaryCapability } from "./capabilities.js";

let initialized = false;
let overlay = null;
let input = null;
let results = null;

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function matches(value, query) {
    return String(value ?? "").toLowerCase().includes(query);
}

function buildResults(query) {
    const normalized = query.trim().toLowerCase();
    const items = [];

    const nav = [
        { name: "Home", route: "#overview", icon: UI_ICONS.home, hint: "Dashboard" },
        { name: "Rooms", route: "#rooms", icon: UI_ICONS.rooms, hint: "Browse rooms" },
        { name: "Devices", route: "#devices", icon: UI_ICONS.devices, hint: "Manage devices" },
    ];
    nav.filter(item => !normalized || matches(`${item.name} ${item.hint}`, normalized))
        .forEach(item => items.push({ ...item, kind: "Navigation" }));

    appState.rooms
        .filter(room => !normalized || matches(`${room.name} room`, normalized))
        .slice(0, 6)
        .forEach(room => items.push({
            name: room.name,
            route: `#rooms/${room.id}`,
            icon: UI_ICONS[room.icon] || UI_ICONS.room,
            hint: "Room",
            kind: "Room"
        }));

    appState.devices
        .filter(device => {
            const capability = getPrimaryCapability(device);
            return !normalized || matches(`${device.name} ${device.room_name || ""} ${device.type || ""} ${getCapabilityLabel(capability || "device")}`, normalized);
        })
        .slice(0, 8)
        .forEach(device => {
            const capability = getPrimaryCapability(device);
            items.push({
                name: formatDeviceName(device.name),
                route: `#devices/${device.hardware_id_hex}`,
                icon: capability ? (CAPABILITY_ICONS[capability] || DEFAULT_ICON) : DEFAULT_ICON,
                hint: `${device.room_name || "Unassigned"} · ${device.online ? "Online" : "Offline"}`,
                kind: "Device"
            });
        });

    return items.slice(0, 14);
}

function renderResults() {
    if (!results || !input) return;
    const items = buildResults(input.value);
    if (!items.length) {
        results.innerHTML = `<div class="search-empty"><strong>No matches</strong><span>Try a device name, room, or page.</span></div>`;
        return;
    }
    results.innerHTML = items.map((item, index) => `
        <a class="search-result" href="${item.route}" data-search-index="${index}">
            <span class="search-result-icon" aria-hidden="true">${item.icon}</span>
            <span class="search-result-copy">
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(item.hint)}</small>
            </span>
            <span class="search-result-kind">${escapeHtml(item.kind)}</span>
        </a>
    `).join("");
}

function closeSearch() {
    overlay?.classList.remove("is-open");
    document.body.classList.remove("search-open");
}

function openSearch() {
    if (!overlay) return;
    overlay.classList.add("is-open");
    document.body.classList.add("search-open");
    input.value = "";
    renderResults();
    requestAnimationFrame(() => input.focus());
}

function ensureMarkup() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "search-overlay";
    overlay.innerHTML = `
        <div class="search-backdrop" data-search-close></div>
        <section class="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title">
            <div class="search-header">
                <div>
                    <p class="card-label">QUICK SEARCH</p>
                    <h2 id="search-title">Find anything</h2>
                </div>
                <button type="button" class="search-close" data-search-close aria-label="Close search">Esc</button>
            </div>
            <label class="search-input-wrap">
                <span aria-hidden="true">${UI_ICONS.devices}</span>
                <input type="search" autocomplete="off" placeholder="Search devices, rooms, or pages…" aria-label="Search devices, rooms, or pages">
                <kbd>Ctrl K</kbd>
            </label>
            <div class="search-results" aria-live="polite"></div>
            <div class="search-footer"><span>Enter to open</span><span>Esc to close</span></div>
        </section>
    `;
    document.body.append(overlay);
    input = overlay.querySelector("input");
    results = overlay.querySelector(".search-results");
    overlay.addEventListener("click", event => {
        if (event.target.closest("[data-search-close]")) closeSearch();
    });
    input.addEventListener("input", renderResults);
    input.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeSearch();
        }
        if (event.key === "Enter") {
            const first = results?.querySelector(".search-result");
            if (first) {
                event.preventDefault();
                first.click();
            }
        }
    });
}

export function initSearch() {
    if (initialized) return;
    initialized = true;
    ensureMarkup();
    document.getElementById("global-search-button")?.addEventListener("click", openSearch);
    document.addEventListener("keydown", event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            openSearch();
        }
        if (event.key === "Escape" && overlay?.classList.contains("is-open")) closeSearch();
    });
}

export function refreshSearch() {
    if (overlay?.classList.contains("is-open")) renderResults();
}
