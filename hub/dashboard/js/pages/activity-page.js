import { createIcon } from '../icon.js';
import { appstate } from '../state.js';
import { activityCategory, renderActivityList, activityCategoryLabel, activityMatchesQuery } from '../components/activity.js';
import { renderEmptyState } from '../components/empty-state.js';
import { escapeHtml } from '../util/dom.js';

let filters = {
    query: '',
    room: 'all',
    device: 'all',
    type: 'all'
};

function getFilteredActivities() {
    return appstate.activities.filter((activity) => {
        return activityMatchesQuery(activity, filters.query)
            && (filters.room === 'all' || activity.room_name === filters.room)
            && (filters.device === 'all' || String(activity.hardware_id_hex) === filters.device)
            && (filters.type === 'all' || activityCategory(activity) === filters.type);
    });
}

function renderStats() {
    const activities = appstate.activities;
    const deviceActions = activities.filter((item) => activityCategory(item) === 'device').length;
    const systemEvents = activities.filter((item) => activityCategory(item) === 'system').length;
    const userActions = activities.filter((item) => activityCategory(item) === 'user').length;

    return `<section class="activity-stats" aria-label="Activity statistics">
        ${[
            ['logs', 'Total events', activities.length],
            ['devices', 'Device actions', deviceActions],
            ['warning', 'System events', systemEvents],
            ['user', 'User actions', userActions]
        ].map(([icon, label, value]) => `
            <article class="activity-stat-card">
                <span class="activity-stat-icon">${createIcon(icon)}</span>
                <div><strong>${value}</strong><span>${label}</span><small>Current history</small></div>
            </article>
        `).join('')}
    </section>`;
}

function renderToolbar() {
    const rooms = [...new Map(appstate.rooms.map(room => [room.id, { id: room.id, name: room.name }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const devices = appstate.devices.filter((device) => appstate.activities.some((item) => String(item.hardware_id_hex) === String(device.hardware_id_hex)));

    return `<section class="activity-toolbar" aria-label="Activity filters">
        <label class="activity-search">
            <span>${createIcon('search')}</span>
            <input type="search" value="${escapeHtml(filters.query)}" placeholder="Search activity..." aria-label="Search activity" data-activity-query>
        </label>
        <select data-activity-room aria-label="Filter by room">
            <option value="all">All rooms</option>
            ${rooms.map((room) => `<option value="${escapeHtml(room.id)}" ${filters.room === room.name ? 'selected' : ''}>${escapeHtml(room.name)}</option>`).join('')}
        </select>
        <select data-activity-device aria-label="Filter by device">
            <option value="all">All devices</option>
            ${devices.map((device) => `<option value="${escapeHtml(String(device.hardware_id_hex))}" ${filters.device === String(device.hardware_id_hex) ? 'selected' : ''}>${escapeHtml(device.name)}</option>`).join('')}
        </select>
        <select data-activity-type aria-label="Filter by event type">
            <option value="all">All event types</option>
            ${['device', 'system', 'user'].map((type) => `<option value="${type}" ${filters.type === type ? 'selected' : ''}>${activityCategoryLabel(type)}</option>`).join('')}
        </select>
        <button type="button" class="activity-clear-button" data-clear-activity-filters>Clear</button>
    </section>`;
}

function renderRoomSummary() {
    const counts = new Map();
    appstate.activities.forEach((activity) => {
        if (activity.room_name) counts.set(activity.room_name, (counts.get(activity.room_name) || 0) + 1);
    });

    if (!counts.size) {
        return `
            <section class="settings-card activity-side-card">
                <div class="settings-card-header">
                    <div class="settings-card-heading">
                        <span class="settings-card-icon">${createIcon('rooms')}</span>
                        <div><h3>Rooms</h3><p>Activity by room.</p></div>
                    </div>
                </div>
                ${renderEmptyState({ icon: 'rooms', title: 'No room activity', message: 'Events will be grouped by room as your home becomes active.' })}
            </section>`;
    }

    return `
        <section class="settings-card activity-side-card">
            <div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon('rooms')}</span><div><h3>Rooms</h3><p>Activity by room.</p></div></div><a class="settings-link" href="#rooms" data-view="rooms">View all ${createIcon('arrow-up-right')}</a></div>
            <div class="activity-room-list">
                ${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([room, count]) => `<button type="button" class="activity-room-row" data-room-filter="${escapeHtml(room)}"><span class="activity-room-icon">${createIcon('rooms')}</span><span>${escapeHtml(room)}</span><strong>${count}</strong></button>`).join('')}
            </div>
        </section>`;
}

export function renderActivityPage() {
    const app = document.querySelector('#app');
    const shown = getFilteredActivities();

    app.innerHTML = `<section class="activity-page" aria-labelledby="activity-page-title">
        <header class="activity-page-header">
            <div>
                <span class="activity-eyebrow">HOME HISTORY</span>
                <h2 id="activity-page-title">Activity</h2>
                <p>View recent events and activity across your smart home devices and rooms.</p>
            </div>
            <div class="activity-live"><span></span> Live</div>
        </header>
        ${renderStats()}
        ${renderToolbar()}
        <div class="activity-page-grid">
            <section class="settings-card activity-feed-card">
                <div class="settings-card-header">
                    <div class="settings-card-heading"><span class="settings-card-icon">${createIcon('logs')}</span><div><h3>Activity Feed</h3><p>${shown.length} event${shown.length === 1 ? '' : 's'} match the current filters.</p></div></div>
                    <span class="activity-feed-status"><span></span> Live updates</span>
                </div>
                <div class="activity-page-list">
                    ${renderActivityList(shown, { icon: 'activity', title: 'No activity found', message: 'Try changing your search or filters.' })}
                </div>
            </section>
            <aside class="activity-sidebar">
                <section class="settings-card activity-side-card">
                    <div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon('settings')}</span><div><h3>Quick Filters</h3><p>Jump to a common event group.</p></div></div></div>
                    <div class="activity-quick-filters">
                        ${[['all', 'All events', appstate.activities.length, 'home'], ['device', 'Device actions', appstate.activities.filter((item) => activityCategory(item) === 'device').length, 'devices'], ['system', 'System events', appstate.activities.filter((item) => activityCategory(item) === 'system').length, 'warning'], ['user', 'User actions', appstate.activities.filter((item) => activityCategory(item) === 'user').length, 'user']].map(([type, label, count, icon]) => `<button type="button" class="activity-quick-filter ${filters.type === type ? 'is-active' : ''}" data-type-filter="${type}"><span>${createIcon(icon)}</span><span>${label}</span><strong>${count}</strong></button>`).join('')}
                    </div>
                </section>
                ${renderRoomSummary()}
            </aside>
        </div>
    </section>`;

    bindActivityPage(app);
}

function bindActivityPage(app) {
    app.querySelector('[data-activity-query]')?.addEventListener('input', (event) => {
        filters.query = event.target.value;
        renderActivityPage();
    });
    app.querySelector('[data-activity-room]')?.addEventListener('change', (event) => {
        filters.room = event.target.value;
        renderActivityPage();
    });
    app.querySelector('[data-activity-device]')?.addEventListener('change', (event) => {
        filters.device = event.target.value;
        renderActivityPage();
    });
    app.querySelector('[data-activity-type]')?.addEventListener('change', (event) => {
        filters.type = event.target.value;
        renderActivityPage();
    });
    app.querySelector('[data-clear-activity-filters]')?.addEventListener('click', () => {
        filters = { query: '', room: 'all', device: 'all', type: 'all' };
        renderActivityPage();
    });
    app.querySelectorAll('[data-type-filter]').forEach((button) => button.addEventListener('click', () => {
        filters.type = button.dataset.typeFilter;
        renderActivityPage();
    }));
    app.querySelectorAll('[data-room-filter]').forEach((button) => button.addEventListener('click', () => {
        filters.room = button.dataset.roomFilter;
        renderActivityPage();
    }));
}
