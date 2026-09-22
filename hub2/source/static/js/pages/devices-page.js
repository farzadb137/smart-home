import { createIcon } from '../icon.js';
import { appstate, updateDeviceFilters } from '../state.js';
import { renderDeviceCard, bindDeviceControls, addDevice } from '../components/device.js';
import { matchesQuery } from '../components/search-engine.js';
import { escapeHtml } from '../util/dom.js';
import { assignDeviceToRoom, startClaim } from '../api.js';

const selection = new Set();
const CLAIM_DURATION_MS = 2 * 60 * 1000;

function shownDevices() {
    const filters = appstate.ui.deviceFilters || { query: '', room: 'all', type: 'all', status: 'all' };

    return appstate.devices.filter((device) =>
        matchesQuery(device, filters.query, (item) => [item.name, item.type, item.room])
        && (filters.room === 'all' || device.room_name === filters.room)
        && (filters.type === 'all' || device.type === filters.type)
        && (filters.status === 'all' || (filters.status === 'online' ? device.online : !device.online))
    );
}

function renderDevicesList() {
    const shown = shownDevices();
    const deviceList = document.querySelector(".devices-list");
    deviceList.innerHTML = `
        ${shown.map((device) => renderDeviceCard(device, {
            selection: selection.has(device.id),
            showLink: true,
            showSelect: true,
        })).join('') || `
            <div class="devices-empty">
                ${createIcon('search')}
                <strong>No devices found</strong>
                <p>Try changing your search or filters.</p>
                <button class="devices-secondary-button" type="button" data-clear-device-filters>Clear filters</button>
            </div>
        `}
    `;
}

export function renderDevicesPage() {
    const filters = appstate.ui.deviceFilters || { query: '', room: 'all', type: 'all', status: 'all' };
    const rooms = [...new Set(appstate.rooms.map(room => room.name))].sort();
    const types = [...new Set(appstate.devices.map((device) => device.type))].sort();
    const shown = shownDevices();
    const online = appstate.devices.filter((device) => device.online).length;
    const allVisibleSelected = shown.length > 0 && shown.every((device) => selection.has(device.id));

    document.querySelector('#app').innerHTML = `
        <section class="devices-view" aria-labelledby="devices-title">
            <div class="devices-hero">
                <div>
                    <span class="devices-eyebrow">HOME CONTROL</span>
                    <h2 id="devices-title">Devices</h2>
                    <p>Monitor every connected device, manage capabilities, and organize your home by room.</p>
                </div>
                <button class="devices-primary-button" type="button" data-add-device>
                    ${createIcon('plus')} Add device
                </button>
            </div>

            <div class="devices-stats">
                ${[
                    ['devices', 'Total devices', appstate.devices.length],
                    ['check-circle', 'Online now', online],
                    ['rooms', 'Assigned rooms', new Set(appstate.devices.map((device) => device.room_name)).size],
                    ['info', 'Offline', appstate.devices.length - online],
                ].map(([icon, label, value]) => `
                    <div class="devices-stat">
                        <span class="devices-stat-icon">${createIcon(icon)}</span>
                        <div><strong>${value}</strong><span>${label}</span></div>
                    </div>
                `).join('')}
            </div>

            <section class="devices-toolbar">
                <div class="devices-search">
                    <span>${createIcon('search')}</span>
                    <input type="search" value="${escapeHtml(filters.query)}" placeholder="Search devices, types, rooms..." data-device-query>
                </div>
                <button class="devices-filter-button" type="button" data-advanced-filters>
                    ${createIcon('settings')} Advanced search
                </button>
                <select data-device-room aria-label="Filter by room">
                    <option value="all">All rooms</option>
                    ${rooms.map((room) => `<option value="${escapeHtml(room)}" ${filters.room === room ? 'selected' : ''}>${escapeHtml(room)}</option>`).join('')}
                </select>
                <select data-device-type aria-label="Filter by type">
                    <option value="all">All types</option>
                    ${types.map((type) => `<option value="${escapeHtml(type)}" ${filters.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
                </select>
            </section>

            <section class="devices-groupbar">
                <div>
                    <span class="devices-selection-count">${selection.size} selected</span>
                    <span class="devices-selection-hint">Select devices to assign them together.</span>
                </div>
                <div class="devices-group-actions">
                    <button class="devices-secondary-button" type="button" data-select-all>${allVisibleSelected ? 'Clear visible' : 'Select visible'}</button>
                    <button class="devices-secondary-button" type="button" data-group-room ${selection.size ? '' : 'disabled'}>
                        ${createIcon('rooms')} Group room assign
                    </button>
                </div>
            </section>

            <div class="devices-list-head">
                <label><input type="checkbox" data-select-all-check ${allVisibleSelected ? 'checked' : ''}> <span>Device</span></label>
                <span>Capability</span>
                <span>Control</span>
                <span></span>
            </div>

            <div class="devices-list"></div>

            <div class="devices-footer">
                <span>Showing ${shown.length} of ${appstate.devices.length} devices</span>
                <span>Last sync just now</span>
            </div>
        </section>
    `;

    renderDevicesList();

    bindEvents();
}

function bindEvents() {
    const root = document.querySelector('#app');

    root.querySelector('[data-device-query]')?.addEventListener('input', (event) => {
        updateDeviceFilters({ query: event.target.value });
        renderDevicesList();
    });

    root.querySelector('[data-device-room]')?.addEventListener('change', (event) => {
        updateDeviceFilters({ room: event.target.value });
        renderDevicesList();
    });

    root.querySelector('[data-device-type]')?.addEventListener('change', (event) => {
        updateDeviceFilters({ type: event.target.value });
        renderDevicesList();
    });

    root.querySelector('[data-clear-device-filters]')?.addEventListener('click', () => {
        updateDeviceFilters({ query: '', room: 'all', type: 'all', status: 'all' });
        renderDevicesList();
    });

    root.querySelector('[data-select-all]')?.addEventListener('click', () => {
        const devices = shownDevices();
        const allSelected = devices.length > 0 && devices.every((device) => selection.has(device.id));
        devices.forEach((device) => (allSelected ? selection.delete(device.id) : selection.add(device.id)));
        renderDevicesPage();
    });

    root.querySelector('[data-select-all-check]')?.addEventListener('change', (event) => {
        shownDevices().forEach((device) => {
            if (event.target.checked) selection.add(device.id);
            else selection.delete(device.id);
        });
        renderDevicesPage();
    });

    root.querySelectorAll('[data-device-select]').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
            if (event.target.checked) selection.add(checkbox.dataset.deviceSelect);
            else selection.delete(checkbox.dataset.deviceSelect);
            renderDevicesPage();
        });
    });

    root.querySelector('[data-advanced-filters]')?.addEventListener('click', openAdvancedFilters);
    root.querySelector('[data-group-room]')?.addEventListener('click', openGroupRoom);
    root.querySelector('[data-add-device]')?.addEventListener('click', openAddDevice);
    bindDeviceControls(root);
}

function modal(body) {
    const backdrop = document.createElement('div');
    backdrop.className = 'devices-modal-backdrop';
    backdrop.innerHTML = body;
    document.body.appendChild(backdrop);

    backdrop.querySelectorAll('[data-close]').forEach((button) => {
        button.addEventListener('click', () => backdrop.remove());
    });

    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) backdrop.remove();
    });

    return backdrop;
}

function openAdvancedFilters() {
    const filters = appstate.ui.deviceFilters;
    const backdrop = modal(`
        <div class="devices-modal">
            <div class="devices-modal-header">
                <div>
                    <span class="devices-eyebrow">FILTER DEVICES</span>
                    <h3>Advanced search</h3>
                </div>
                <button type="button" data-close aria-label="Close">${createIcon('plus')}</button>
            </div>
            <div class="devices-form">
                <label>Status
                    <select data-status>
                        <option value="all">All status</option>
                        <option value="online">Online</option>
                        <option value="offline">Offline</option>
                    </select>
                </label>
            </div>
            <div class="devices-modal-actions">
                <button class="devices-secondary-button" type="button" data-close>Cancel</button>
                <button class="devices-primary-button" type="button" data-apply>Apply filters</button>
            </div>
        </div>
    `);

    backdrop.querySelector('[data-status]').value = filters.status;
    backdrop.querySelector('[data-apply]').addEventListener('click', () => {
        updateDeviceFilters({ status: backdrop.querySelector('[data-status]').value });
        backdrop.remove();
        renderDevicesPage();
    });
}

function openGroupRoom() {
    const selected = appstate.devices.filter((device) => selection.has(device.id));
    if (!selected.length) return;

    const rooms = [...new Map(appstate.rooms.map(room => [room.id, { id: room.id, name: room.name }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name));
    const backdrop = modal(`
        <div class="devices-modal">
            <div class="devices-modal-header">
                <div>
                    <span class="devices-eyebrow">BULK ACTION</span>
                    <h3>Assign room</h3>
                </div>
                <button type="button" data-close aria-label="Close">${createIcon('plus')}</button>
            </div>
            <label class="devices-modal-field">Room
                <select data-room>${rooms.map((room) => `<option value="${escapeHtml(String(room.id))}">${escapeHtml(room.name)}</option>`).join('')}</select>
            </label>
            <div class="devices-modal-actions">
                <button class="devices-secondary-button" type="button" data-close>Cancel</button>
                <button class="devices-primary-button" type="button" data-apply>Assign devices</button>
            </div>
        </div>
    `);

    backdrop.querySelector('[data-apply]').addEventListener('click', async () => {
        const roomEl = backdrop.querySelector('[data-room]');
        const roomId = roomEl?.value ? Number(roomEl.value) : null;
        const devices = [...selected];

        const results = await Promise.allSettled(
            devices.map((device) => assignDeviceToRoom(device.hardware_id_hex, roomId))
        );

        let success = 0;
        results.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value?.success !== false) {
                success += 1;
                selection.delete(devices[index].id);
            }
        });

        backdrop.remove();
        renderDevicesPage();
    });
}

async function openAddDevice() {
    const backdrop = modal(`
        <div class="devices-modal devices-claim-modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
            <div class="devices-modal-header">
                <div>
                    <span class="devices-eyebrow">DEVICE SETUP</span>
                    <h3 id="claim-title">Add a new device</h3>
                    <p>Use this temporary claim code to connect the device to your smart home.</p>
                </div>
                <button type="button" data-close aria-label="Close">${createIcon('plus')}</button>
            </div>

            <div class="claim-active-state" id="active-state">
                <div class="claim-code" id="claim-code" aria-label="Claim code">------</div>
                <div class="claim-timer" id="claim-timer">02:00 remaining</div>

                <ol class="claim-steps">
                    <li>Power on the new device.</li>
                    <li>On your phone, connect to its WiFi network: <b>SmartTemp-Setup-XXXX</b></li>
                    <li>Open <b>192.168.4.1</b> in your browser (it should open automatically).</li>
                    <li>Select your home WiFi network and enter its password.</li>
                    <li>Hub Address: <b id="hub-address"></b></li>
                    <li>Claim Code: <b id="claim-code-inline"></b></li>
                    <li>Submit — the device finishes setup on its own.</li>
                </ol>

                <div class="claim-expired" data-claim-expired hidden>
                    This claim code has expired. Generate a new code to continue setup.
                </div>

                <div class="claim-error" data-claim-error hidden role="alert"></div>

                <div class="devices-modal-actions claim-actions">
                    <button class="devices-secondary-button" type="button" data-close>Close</button>
                    <button class="devices-primary-button" id="restart-btn" type="button">Generate a new code</button>
                </div>
            </div>
        </div>
    `);

    const codeElement = backdrop.querySelector('#claim-code');
    const inlineCodeElement = backdrop.querySelector('#claim-code-inline');
    const timerElement = backdrop.querySelector('#claim-timer');
    const expiredElement = backdrop.querySelector('[data-claim-expired]');
    const errorElement = backdrop.querySelector('[data-claim-error]');
    const restartButton = backdrop.querySelector('#restart-btn');
    const hubAddressElement = backdrop.querySelector('#hub-address');

    hubAddressElement.textContent = window.location.hostname;

    let timerId = null;
    let expiresAt = 0;
    let isGenerating = false;

    function updateTimer() {
        const remaining = Math.max(0, expiresAt - Date.now());
        const totalSeconds = Math.ceil(remaining / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        timerElement.textContent = remaining > 0 ? `${minutes}:${seconds} remaining` : '00:00 — code expired';

        if (remaining <= 0) {
            clearInterval(timerId);
            timerId = null;
            expiredElement.hidden = false;
            restartButton.classList.remove('devices-primary-button');
            restartButton.classList.add('devices-secondary-button');
        }
    }

    function stopTimer() {
        if (timerId !== null) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    async function generateCode() {
        if (isGenerating) return;
        isGenerating = true;
        restartButton.disabled = true;
        errorElement.hidden = true;

        try {
            const result = await startClaim();
            const code = result.data.code;
            expiresAt = Date.now() + CLAIM_DURATION_MS;
            codeElement.textContent = code;
            inlineCodeElement.textContent = code;
            expiredElement.hidden = true;
            restartButton.classList.add('devices-primary-button');
            restartButton.classList.remove('devices-secondary-button');
            stopTimer();
            updateTimer();
            timerId = setInterval(updateTimer, 1000);
        } catch (error) {
            codeElement.textContent = '------';
            errorElement.textContent = 'Could not generate a claim code. Please try again.';
            errorElement.hidden = false;
        } finally {
            isGenerating = false;
            restartButton.disabled = false;
        }
    }

    restartButton.addEventListener('click', generateCode);
    backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop || event.target.closest('[data-close]')) {
            stopTimer();
        }
    });

    generateCode();
}
