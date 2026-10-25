// Room domain module: room data, statistics, cards, device grouping and room mutations.
import { createIcon } from '../icon.js';
import { appstate } from '../state.js';
import { escapeHtml } from '../util/dom.js';
import { deviceById, deviceControl, deviceCapability, deviceIcon } from './device.js';
import { renderEmptyState } from './empty-state.js';

export const ROOM_ASSETS = {
    'Living Room': { image: 'assets/rooms/living-room.jpg', icon: 'living-room' },
    'Bedroom':     { image: 'assets/rooms/bedroom.jpg',     icon: 'bedroom' },
    'Kitchen':     { image: 'assets/rooms/kitchen.jpg',     icon: 'kitchen' },
    'Bathroom':    { image: 'assets/rooms/bathroom.jpg',    icon: 'bathroom' },
    'Office':      { image: 'assets/rooms/living-room.jpg', icon: 'rooms' },
    'Garage':      { image: 'assets/rooms/garage.jpg',      icon: 'garage' },
};

export const ROOM_TYPES = Object.keys(ROOM_ASSETS);

const DEFAULT_ASSET = { image: 'assets/rooms/living-room.jpg', icon: 'rooms' };

export function roomById(id) {
    return appstate.rooms.find((room) => String(room.id) === String(id));
}

export function roomDeviceById(id) {
    return deviceById(id);
}

export function roomDevices(room) {
    return appstate.devices.filter((device) => room.device_ids.includes(device.hardware_id_hex));
}

export function roomActivity(room) {
    return appstate.activities.filter((activity) => activity.room_name === room.name).slice(0, 5);
}

export function roomMetrics(room) {
    const roomDevices = appstate.devices.filter((device) => room.device_ids.includes(device.hardware_id_hex));

    let temperature = null;
    let humidity = null;

    for (const device of roomDevices) {
        const readings = device.readings || {};
        if (temperature === null && readings.temperature)   temperature = readings.temperature.value;
        if (humidity === null && readings.humidity)   humidity = readings.humidity.value;
    }
    return { temperature, humidity };
}

export function roomActiveDeviceCount(room) {
    return roomDevices(room).filter((device) => device.online).length;
}

export function roomStats() {
    const temperatures = appstate.rooms
        .map((room) => Number.parseFloat(roomMetrics(room).temperature))
        .filter(Number.isFinite);

    const totalDevices = appstate.rooms.reduce((total, room) => total + roomDevices(room).length, 0);
    const activeRooms = appstate.rooms.filter((room) => roomActiveDeviceCount(room) > 0).length;
    const averageTemperature = temperatures.length
        ? `${(temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length).toFixed(1)}°C`
        : '—';

    return {
        totalRooms: appstate.rooms.length,
        totalDevices,
        activeRooms,
        averageTemperature
    };
}

export function roomImage(room) {
    return (ROOM_ASSETS[room.type] || DEFAULT_ASSET).image;
}

export function roomIcon(room) {
    return (ROOM_ASSETS[room.type] || DEFAULT_ASSET).icon;
}

export function renderRoomStats() {
    const stats = roomStats();
    const cards = [
        ['rooms', stats.totalRooms, 'Total rooms', 'room-stat-blue'],
        ['devices', stats.totalDevices, 'Total devices', 'room-stat-green'],
        ['check-circle', stats.activeRooms, 'Active rooms', 'room-stat-primary'],
        ['temperature', stats.averageTemperature, 'Avg. temperature', 'room-stat-purple']
    ];

    return `<section class="rooms-stat-grid" aria-label="Room statistics">
        ${cards.map(([icon, value, label, tone]) => `<article class="room-stat-card ${tone}">
            <span class="room-stat-icon">${createIcon(icon)}</span>
            <div><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>
        </article>`).join('')}
    </section>`;
}

export function renderRoomCard(room) {
    const metrics = roomMetrics(room);
    const devices = roomDevices(room);
    const image = roomImage(room);
    const activeDevices = roomActiveDeviceCount(room);
    const types = {};

    devices.forEach((device) => {
        types[deviceIcon(device)] = (types[deviceIcon(device)] || 0) + 1;
    });

    return `
        <a class="room-card" href="#room/${encodeURIComponent(room.id)}" data-view="room/${encodeURIComponent(room.id)}" aria-label="Open ${escapeHtml(room.name)} room">
            <img class="room-card-image" src="${image}" alt="${escapeHtml(room.name)}" loading="lazy">
            <div class="room-card-overlay"></div>
            <div class="room-card-content">
                <div class="room-card-top">
                    <div class="room-card-title">
                        <span class="room-card-title-icon">${createIcon(roomIcon(room))}</span>
                        <div><h3>${escapeHtml(room.name)}</h3><span>${devices.length} device${devices.length === 1 ? '' : 's'} · ${activeDevices} active</span></div>
                    </div>
                    <div class="room-metrics">
                        <span class="room-metric">${createIcon('temperature')}${escapeHtml(metrics.temperature ? Number(metrics.temperature).toFixed(1) : "--")}</span>
                        <span class="room-metric">${createIcon('humidity')}${escapeHtml(metrics.humidity ? Number(metrics.humidity).toFixed(1) : "--")}</span>
                    </div>
                </div>
                <div class="room-card-bottom">
                    <div class="room-devices">
                        ${Object.entries(types).slice(0, 5).map(([icon, count]) => `<span class="room-device" title="${count} ${icon}"><span class="room-device-icon">${createIcon(icon)}</span><strong>${count}</strong></span>`).join('')}
                    </div>
                    <span class="room-card-arrow">${createIcon('arrow-up-right')}</span>
                </div>
            </div>
        </a>`;
}

export function renderRoomCards(rooms = appstate.rooms, emptyOptions = {}) {
    if (!rooms.length) {
        return renderEmptyState({
            icon: emptyOptions.icon || 'rooms',
            title: emptyOptions.title || 'No rooms yet',
            message: emptyOptions.message || 'Create a room to organize devices and see your home at a glance.',
            className: `rooms-empty-state ${emptyOptions.className || ''}`
        });
    }

    return rooms.map(renderRoomCard).join('');
}

export function renderRooms() {
    return `
        <section class="rooms-section" aria-labelledby="rooms-title">
            <div class="dashboard-panel-header">
                <div class="dashboard-panel-heading">
                    <span class="dashboard-panel-icon">${createIcon('rooms')}</span>
                    <div><h2 id="rooms-title" class="dashboard-panel-title">Rooms</h2><p class="dashboard-panel-subtitle">Your home at a glance</p></div>
                </div>
                <a class="dashboard-panel-link" href="#rooms" data-view="rooms">View all rooms ${createIcon('arrow-up-right')}</a>
            </div>
            <div class="rooms-grid">${renderRoomCards()}</div>
        </section>`;
}

export function renderRoomDeviceCards(room) {
    const devices = roomDevices(room);

    if (!devices.length) {
        return renderEmptyState({
            icon: 'devices',
            title: 'No devices in this room',
            message: 'Devices assigned to this room will appear here.'
        });
    }

    return devices.map((device) => `<article class="room-device-row ${device.online ? '' : 'is-offline'}">
        <span class="room-detail-device-icon">${createIcon(device.icon || 'devices')}</span>
        <div class="room-detail-device-copy"><strong>${escapeHtml(device.name)}</strong><span>${escapeHtml(device.type)} · ${escapeHtml(device.online ? 'Online' : 'Offline')}</span></div>
        <strong class="room-detail-device-value">${escapeHtml(String(deviceCapability(device)))}</strong>
        <div class="room-detail-device-control">${deviceControl(device)}</div>
        <a class="room-device-open" href="#device/${encodeURIComponent(device.id)}" data-view="device/${encodeURIComponent(device.id)}" aria-label="Open ${escapeHtml(device.name)}">${createIcon('arrow-up-right')}</a>
    </article>`).join('');
}


