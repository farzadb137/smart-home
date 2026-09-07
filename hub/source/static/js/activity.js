import { apiRequestFn } from "./api.js";
import { UI_ICONS } from "./icons.js";

let initialized = false;
let loading = false;

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
}

function formatTime(value) {
    if (!value) return "";
    const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function iconFor(type) {
    if (type?.startsWith("device")) return UI_ICONS.devices;
    if (type?.startsWith("room")) return UI_ICONS.rooms;
    if (type === "command") return UI_ICONS.activity;
    return UI_ICONS.activity;
}

function render(root, events) {
    // Be defensive about API response shape so a null/legacy response cannot
    // break the Activity page.
    const safeEvents = Array.isArray(events) ? events : (Array.isArray(events?.items) ? events.items : []);
    root.innerHTML = `
        <div class="page-header">
            <div>
                <p class="card-label">SYSTEM</p>
                <h1>Activity</h1>
                <p>Recent actions and changes made in your smart home.</p>
            </div>
            <button class="secondary-button activity-refresh" type="button">Refresh</button>
        </div>
        <section class="card activity-page-card">
            ${safeEvents.length ? `<div class="activity-list">${safeEvents.map(event => `
                <article class="activity-row">
                    <div class="activity-row-icon">${iconFor(event.type)}</div>
                    <div class="activity-row-main">
                        <strong>${escapeHtml(event.message)}</strong>
                        <div class="activity-row-meta">
                            <span>${escapeHtml(formatTime(event.created_at))}</span>
                            ${event.username ? `<span>by ${escapeHtml(event.username)}</span>` : ""}
                            ${event.room_name ? `<span>${escapeHtml(event.room_name)}</span>` : ""}
                        </div>
                    </div>
                </article>
            `).join("")}</div>` : `
                <div class="empty-state">
                    <span class="empty-state-icon" data-icon="activity">${UI_ICONS.activity}</span>
                    <div><strong>No activity yet</strong><p>Device commands and organization changes will appear here.</p></div>
                </div>
            `}
        </section>`;
    root.querySelector(".activity-refresh")?.addEventListener("click", () => refreshActivity(root));
}

export async function refreshActivity(root) {
    if (!root || loading) return;
    loading = true;
    try {
        const response = await apiRequestFn("/activity?limit=100");
        render(root, response);
    } catch (error) {
        console.error("Failed to load activity:", error);
        root.innerHTML = `<section class="card"><div class="empty-state"><span class="empty-state-icon">${UI_ICONS.alert}</span><div><strong>Activity unavailable</strong><p>${escapeHtml(error.message)}</p></div></div></section>`;
    } finally {
        loading = false;
    }
}

export function initActivityPage() {
    if (initialized) return;
    initialized = true;
}
