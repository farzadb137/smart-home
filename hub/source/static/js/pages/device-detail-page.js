import { createIcon } from "../icon.js";
import { appstate } from "../state.js";
import { escapeHtml, formatTimestamp } from '../util/dom.js';
import { renderHistorySection, bindChartActions, eventHistory } from '../components/chart.js';
import { deviceCapability, deviceControl, deviceById, bindDeviceControls, removeDevice, updateDevice, deviceIcon, deviceSignal } from '../components/device.js';
import { assignDeviceToRoom, renameDevice } from "../api.js";

function bindDeviceDetailEvents(id) {
    const d = deviceById(id);
    if(!d) return;

    //bindChartActions({ id, device: d, onReloadPage: () => { renderDeviceDetailPage(id); }});
    
    document.querySelector('[data-device-edit-detail]')?.addEventListener('click', () => {
        document.querySelector('[data-device-config]')?.scrollIntoView({ behavior: 'smooth', block:'center' });
        document.querySelector('[data-device-config] input')?.focus();
    });
    document.querySelector('[data-device-config]')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const deviceName = String(fd.get('name')).trim()
        const roomName = fd.get('room').trim();
        const room = appstate.rooms.find((room) => room.name === roomName);
        if (room)
            await assignDeviceToRoom(d.hardware_id_hex, room.id);
        await renameDevice(d.hardware_id_hex, deviceName);
        renderDeviceDetailPage(id);
    });
    document.querySelector('[data-device-reset-config]')?.addEventListener('click', () => renderDeviceDetailPage(id));
    document.querySelector('[data-device-ping]')?.addEventListener('click', () => alert(d.online?'Diagnostics complete: connection, control channel, and telemetry are healthy.':'Device is offline. Check power, network range, and hub connection.'));
    document.querySelector('[data-firmware-update]')?.addEventListener('click', () => {
        if (!d.firmwareAvailable) return;
        updateDevice(d.id, { firmware: d.firmwareAvailable, firmwareAvailable: null });
        renderDeviceDetailPage(id);
    });
    document.querySelector('[data-device-remove]')?.addEventListener('click', () => {
        if (!confirm(`Remove ${d.name} from this home?`)) return;
        removeDevice(d.id);
        window.location.hash = 'devices';
    });
    const appRoot = document.querySelector('#app');
    appRoot?.addEventListener('device:changed', () => renderDeviceDetailPage(id), { once: true });
    bindDeviceControls(appRoot);
}

export function renderDeviceDetailPage(id) {

    const app = document.querySelector('#app');
    const d = deviceById(id);
    if (!d) {
        app.innerHTML = `
            <section class="devices-view">
                <div class="devices-empty">
                    <strong>Device not found</strong>
                    <p>This device may have been removed.</p>
                    <a class="devices-secondary-button" href="#devices">Back to devices</a>
                </div>
            </section>`;
        return;
    }

    const roomOptions = [...new Set(appstate.rooms.map(room => room.name))].sort();
    const control = deviceControl(d);
    const range = '24h';
    const firmwareVersion = d.firmware || 'undefined';
    const firstSeen = formatTimestamp(d.first_seen) || 'undefined';
    const hardware = d.hardware || 'undefined';
    const model = d.model || 'undefined';
    const liveValue = escapeHtml(deviceCapability(d));

    app.innerHTML = `
        <section class="devices-view device-detail-view" aria-labelledby="device-detail-title">
            <div class="device-detail-topbar">
                <a href="#devices" class="device-detail-back" data-view="devices">${createIcon('arrow-left')} Back to devices</a>
                <span class="device-detail-route">DEVICES / ${escapeHtml(d.type.toUpperCase())}</span>
            </div>
            <div class="device-detail-hero">
                <div class="device-detail-identity">
                    <div class="device-detail-icon">${createIcon(deviceIcon(d))}</div>
                    <div>
                        <span class="devices-eyebrow">${escapeHtml(d.type.toUpperCase())}</span>
                        <h2 id="device-detail-title">${escapeHtml(d.name)}</h2>
                        <p><span class="device-online ${d.online?'':'is-offline'}"><i></i>${d.online ? 'Online' : 'Offline'}</span><span class="detail-divider">•</span>${escapeHtml(d.room_name)}</p>
                    </div>
                </div>
                <div class="device-detail-actions">
                    <button class="devices-secondary-button" type="button" data-device-edit-detail="${d.id}">${createIcon('edit')} Edit config</button>
                    ${control}
                </div>
            </div>
            <div class="device-detail-live-grid">
                <section class="detail-live-card detail-live-main">
                    <div class="detail-card-kicker">
                        <span>${createIcon('activity')}</span> LIVE DATA <em>Updated just now</em>
                    </div>
                    <div class="live-value-row">
                        <div>
                            <span>Current capability</span>
                            <strong>${liveValue}</strong>
                            <small>${d.online ? 'Device is reporting normally' : 'Waiting for connection'}</small>
                        </div>
                        <div class="live-pulse ${d.online?'':'offline'}"><i></i><span>${d.online?'LIVE':'OFFLINE'}</span></div>
                    </div>
                    <div class="live-mini-grid">
                        <div><span>Signal</span><strong>${d.online?deviceSignal(d):'—'}</strong></div>
                        <div><span>Latency</span><strong>${d.online?'38 ms':'—'}</strong></div>
                        <div><span>Power</span><strong>${d.online?'Normal':'Unknown'}</strong></div>
                        <div><span>Last update</span><strong>${d.last_seen}</strong></div>
                    </div>
                </section>
                <section class="detail-live-card">
                    <div class="detail-card-kicker"><span>${createIcon('check-circle')}</span> HEALTH <em>Connection diagnostics</em></div>
                    <div class="health-score">
                        <div class="health-ring"><strong>${d.online?'98':'0'}</strong><span>%</span></div>
                        <div>
                            <strong>${d.online?'Healthy':'Disconnected'}</strong>
                            <p>${d.online?'All core checks are passing.':'Reconnect the device to resume live telemetry.'}</p>
                            <button class="text-action" type="button" data-device-ping="${d.id}">${createIcon('activity')} Run diagnostics</button>
                        </div>
                    </div>
                </section>
            </div>
            <div class="device-detail-main-grid">
                --
                <aside class="settings-card device-info-card">
                    <div class="settings-card-header">
                        <div class="settings-card-heading">
                            <span class="settings-card-icon">${createIcon('info')}</span>
                            <div><h3>Device information</h3><p>Hardware and provisioning details.</p></div>
                        </div>
                    </div>
                    <dl class="device-info-list">
                        <div><dt>Hardware ID</dt><dd>${escapeHtml(d.hardware_id_hex)}</dd></div>
                        <div><dt>Room name</dt><dd>${escapeHtml(d.room_name)}</dd></div>
                        <div><dt>Model</dt><dd>${escapeHtml(model)}</dd></div>
                        <div><dt>Firmware</dt><dd>${escapeHtml(firmwareVersion)}</dd></div>
                        <div><dt>Hardware</dt><dd>${escapeHtml(hardware)}</dd></div>
                        <div><dt>First seen</dt><dd>${escapeHtml(firstSeen)}</dd></div>
                    </dl>
                </aside>
            </div>
            <div class="device-detail-main-grid lower">
                <section class="settings-card">
                    <div class="settings-card-header">
                        <div class="settings-card-heading">
                            <span class="settings-card-icon">${createIcon('settings')}</span>
                            <div><h3>Device configuration</h3><p>Change the name and room used across your dashboard.</p></div>
                        </div>
                        <span class="settings-save-state">Saved locally</span>
                    </div>
                    <form class="device-config-form" data-device-config="${d.id}">
                        <label>Device name<input name="name" required value="${escapeHtml(d.name)}"></label>
                        <label>Room<select name="room">${roomOptions.map(room => `<option ${room === d.room_name?'selected':''}>${escapeHtml(room)}</option>`).join('')}</select></label>
                        <div class="device-form-actions">
                            <button class="devices-secondary-button" type="button" data-device-reset-config>Reset</button>
                            <button class="devices-primary-button" type="submit">${createIcon('check-circle')} Save configuration</button>
                        </div>
                    </form>
                </section>
                <section class="settings-card">
                    <div class="settings-card-header">
                        <div class="settings-card-heading">
                            <span class="settings-card-icon">${createIcon('download')}</span>
                            <div><h3>Firmware update</h3><p>Keep this device secure and compatible with the latest hub software.</p></div>
                        </div>
                        <span class="firmware-badge">CURRENT ${escapeHtml(firmwareVersion)}</span>
                    </div>
                    <div class="firmware-update-box">
                        <div>
                            <strong>Firmware ${escapeHtml(d.firmwareAvailable || '1.8.4')}</strong>
                            <span>${d.firmwareAvailable && d.firmwareAvailable !== firmwareVersion ? 'A new version is ready to install.' : 'Your device is running the latest approved version.'}</span>
                        </div>
                        <button class="devices-primary-button" type="button" data-firmware-update="${d.id}" ${d.firmwareAvailable && d.firmwareAvailable !== firmwareVersion ? '' : 'disabled'}>${createIcon('download')} ${d.firmwareAvailable && d.firmwareAvailable !== firmwareVersion ? 'Update firmware' : 'Up to date'}</button>
                    </div>
                    <div class="firmware-note">
                        <span>${createIcon('shield')}</span>
                        <span>Firmware updates are staged through the hub. Controls remain available after a successful restart.</span>
                    </div>
                </section>
            </div>
            <section class="settings-card device-activity-card">
                <div class="settings-card-header">
                    <div class="settings-card-heading">
                        <span class="settings-card-icon">${createIcon('logs')}</span>
                        <div><h3>Recent device activity</h3><p>Latest events from this device.</p></div>
                    </div>
                    <a href="#activity" class="text-action" data-view="activity">View all activities ${createIcon('arrow-up-right')}</a>
                </div>
                <div class="device-event-list">
                --
                </div>
            </section>
            <section class="device-danger-zone">
                <div>
                    <span class="danger-icon">${createIcon('warning')}</span>
                    <div>
                        <strong>Remove device</strong>
                        <p>Disconnect this device from the home. Its local history will no longer update.</p>
                    </div>
                </div>
                <button class="danger-button" type="button" data-device-remove="${d.id}">Remove device</button>
            </section>
        </section>`;

    bindDeviceDetailEvents(id);

}