import { renderDeviceCards, updateDeviceCards, updateFavoriteButtons } from "./device-card.js";
import { getFavoriteDevices } from "../state.js";
import { renderHomeRoomsPreview, getRoomModels } from "../rooms-page.js";
import { UI_ICONS } from "../icons.js";
import { renderHomeHero } from "./home-hero.js";

function getSwitchDevices(devices) {
    return devices.filter(device =>
        device.capabilities?.includes?.("switch") || device.readings?.switch
    );
}


function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function renderHomeInsights(state) {
    const automations = Array.isArray(state.automations) ? state.automations : [];
    const activity = Array.isArray(state.activity) ? state.activity : [];
    const rooms = getRoomModels(state);
    const target = document.querySelector(".home-insights-content");
    if (!target) return;
    const enabled = automations.filter(a => a.enabled).length;
    const offline = state.devices.filter(d => !d.online).length;
    const roomCount = rooms.length;
    const latest = activity.slice(0, 3);
    target.innerHTML = `
      <div class="home-insight-stats">
        <a href="#automations" class="home-insight-stat" data-route="automations"><span class="home-insight-stat-icon">${UI_ICONS.automation || UI_ICONS.activity}</span><strong>${enabled}</strong><span>Automations active</span></a>
        <a href="#rooms" class="home-insight-stat" data-route="rooms"><span class="home-insight-stat-icon">${UI_ICONS.rooms}</span><strong>${roomCount}</strong><span>Rooms organized</span></a>
        <div class="home-insight-stat ${offline ? "has-warning" : ""}"><span class="home-insight-stat-icon">${UI_ICONS.devices}</span><strong>${offline}</strong><span>${offline ? "Devices offline" : "No devices offline"}</span></div>
      </div>
      <div class="home-recent-list">
        <div class="home-recent-head"><span>Recent activity</span><a href="#activity" data-route="activity">View all</a></div>
        ${latest.length ? latest.map(e => `<div class="home-recent-row"><span class="home-recent-icon">${UI_ICONS.activity}</span><div><strong>${escapeHtml(e.message)}</strong><small>${escapeHtml(e.room_name || e.username || "System")}</small></div></div>`).join("") : `<div class="home-recent-empty">No activity yet. Device commands and changes will appear here.</div>`}
      </div>`;
}

export function renderHomeOverview(state, options = {}) {
    renderHomeHero(state);
    const totalEl = document.getElementById("home-device-count");
    const onlineEl = document.getElementById("home-online-count");
    const offlineEl = document.getElementById("home-offline-count");
    const quickControls = document.querySelector(".quick-controls-list");

    const devices = Array.isArray(state.devices) ? state.devices : [];
    const online = devices.filter(device => device.online).length;
    const offline = devices.length - online;

    if (totalEl) totalEl.textContent = String(devices.length);
    if (onlineEl) onlineEl.textContent = String(online);
    if (offlineEl) offlineEl.textContent = String(offline);

    if (quickControls) {
        const favorites = getFavoriteDevices(devices).filter(device => getSwitchDevices([device]).length);
        const switchDevices = (favorites.length ? favorites : getSwitchDevices(devices)).slice(0, 4);
        if (options.source === "poll") {
            updateDeviceCards(quickControls, switchDevices);
            updateFavoriteButtons(quickControls);
        } else {
            renderDeviceCards(quickControls, switchDevices, {
                favorite: true,
                emptyTitle: "No quick controls yet",
                emptyText: "Favorite a switch-capable device to keep it here, or connect a switch to get started.",
                onFavoriteChange: () => renderHomeOverview(state, { source: "manual" })
            });
        }
    }

    renderHomeRoomsPreview(state, { source: options.source, quickControls: true });
    renderHomeInsights(state);
}
