import { createIcon } from '../icon.js';
import { appstate } from '../state.js';
import { renderRoomClimateChart } from '../components/chart.js';
import { bindDeviceControls } from '../components/device.js';
import { renderActivityList } from '../components/activity.js';
import { renderInfoTable } from '../components/info-table.js';
import { roomById, roomDevices, roomActivity, roomMetrics, roomActiveDeviceCount, renderRoomDeviceCards, roomImage, roomIcon } from '../components/room.js';
import { escapeHtml, formatTimestamp } from '../util/dom.js';

let historyRange = '24h';

function renderRoomHeader(room) {
    const metrics = roomMetrics(room);
    const devices = roomDevices(room);
    const active = roomActiveDeviceCount(room);
    const image = roomImage(room);
    const icon = roomIcon(room);

    return `<section class="room-detail-hero">
        <img src="${image}" alt="${escapeHtml(room.name)}" class="room-detail-hero-image">
        <div class="room-detail-hero-overlay"></div>
        <div class="room-detail-hero-top">
            <a href="#rooms" data-view="rooms" class="room-detail-back">${createIcon('arrow-left')} Back to Rooms</a>
            <button type="button" class="room-detail-more" aria-label="Room actions">•••</button>
        </div>
        <div class="room-detail-hero-content">
            <span class="room-detail-icon">${createIcon(icon)}</span>
            <div><span class="settings-eyebrow">ROOM</span><h2>${escapeHtml(room.name)}</h2><p>${devices.length} device${devices.length === 1 ? '' : 's'} · ${active} active</p></div>
        </div>
        <div class="room-detail-hero-metrics">
            <span>${createIcon('temperature')} ${escapeHtml(metrics.temperature ? Number(metrics.temperature).toFixed(1) : "--")}</span>
            <span>${createIcon('humidity')} ${escapeHtml(metrics.humidity ? Number(metrics.humidity).toFixed(1) : "--")}</span>
        </div>
    </section>`;
}

function renderRoomMetricCards(room) {
    const metrics = roomMetrics(room);
    const devices = roomDevices(room);
    const cards = [
        ['temperature', metrics.temperature ? Number(metrics.temperature).toFixed(1) : "--", 'Temperature'],
        ['humidity', metrics.humidity ? Number(metrics.humidity).toFixed(1) : "--", 'Humidity'],
        ['check-circle', roomActiveDeviceCount(room), 'Active devices'],
        ['devices', devices.length, 'Total devices']
    ];

    return `
        <section class="room-detail-metrics" aria-label="Room status">
            ${cards.map(([icon, value, label]) => `<article class="room-detail-metric-card"><span>${createIcon(icon)}</span><div><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(label)}</small></div></article>`).join('')}
        </section>`;
}

function renderRoomActivity(room) {
    const activities = roomActivity(room);
    const content = renderActivityList(activities, { icon: 'activity', title: 'No activity yet', message: 'Activity for this room will appear here.' });

    return `
        <section class="settings-card room-detail-activity-card">
            <div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon('activity')}</span><div><h3>Recent Activity</h3><p>Latest events from this room.</p></div></div></div>
            <div class="activity-list">${content}</div>
        </section>`;
}

export function renderRoomDetailPage(id) {
    const app = document.querySelector('#app');
    const room = roomById(decodeURIComponent(id));
    if (!room) {
        app.innerHTML = `<section class="settings-view"><div class="settings-hero"><div><span class="settings-eyebrow">ROOM NOT FOUND</span><h2>Room unavailable</h2><p>The selected room no longer exists in the current application state.</p></div><a class="settings-link" href="#rooms" data-view="rooms">Back to Rooms</a></div></section>`;
        return;
    }

    app.innerHTML = `
        <section class="room-detail-page">
            ${renderRoomHeader(room)}
            ${renderRoomMetricCards(room)}
            <div class="room-detail-main-grid">
                <div class="room-detail-primary">
                    <section class="settings-card room-devices-card">
                        <div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon('devices')}</span><div><h3>Room Devices</h3><p>Control devices assigned to ${escapeHtml(room.name)}.</p></div></div><a class="settings-link" href="#devices" data-view="devices">View all ${createIcon('arrow-up-right')}</a></div>
                        <div class="room-device-list">${renderRoomDeviceCards(room)}</div>
                    </section>
                    <section class="settings-card room-climate-card">
                        <div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon('activity')}</span><div><h3>Temperature &amp; Humidity</h3><p>Room climate trend for the selected period.</p></div></div><div class="history-range-tabs" role="tablist">${['24h', '7d', '30d', '90d', '1y'].map((range) => `<button type="button" class="${historyRange === range ? 'is-active' : ''}" data-room-history-range="${range}" role="tab" aria-selected="${historyRange === range}">${range.toUpperCase()}</button>`).join('')}</div></div>
                        --
                    </section>
                </div>
                <aside class="room-detail-sidebar">
                    ${renderInfoTable([
                        { label: 'Room name', value: room.name },
                        { label: 'Room type', value: room.type || room.name },
                        { label: 'Total devices', value: roomDevices(room).length },
                        { label: 'Active devices', value: roomActiveDeviceCount(room) },
                        { label: 'Created', value: formatTimestamp(room.created_at) || 'Not specified' }
                    ], { title: 'Room Information', icon: 'info' })}
                    ${renderRoomActivity(room)}
                </aside>
            </div>
        </section>`;

    bindRoomDetail(app, room);
}

function bindRoomDetail(app, room) {
    bindDeviceControls(app);

    app.querySelectorAll('[data-room-history-range]').forEach((button) => {
        button.addEventListener('click', () => {
            historyRange = button.dataset.roomHistoryRange;
            renderRoomDetailPage(room.id);
        });
    });
}
