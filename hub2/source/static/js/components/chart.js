// Chart domain module: numeric trends and event history for device telemetry.
import { createIcon } from '../icon.js';
import { escapeHtml } from '../util/dom.js';

function detailRangeConfig(range) {
    return {
        '24h': { points: 24, step: 1, unit: 'h', labels: ['00:00','04:00','08:00','12:00','16:00','20:00','Now'] },
        '7d': { points: 14, step: 12, unit: 'h', labels: ['Sep 5','Sep 6','Sep 7','Sep 8','Sep 9','Sep 10','Now'] },
        '30d': { points: 15, step: 2, unit: 'd', labels: ['Aug 13','Aug 17','Aug 21','Aug 25','Aug 29','Sep 2','Now'] },
        '90d': { points: 15, step: 6, unit: 'd', labels: ['Jun 14','Jun 28','Jul 12','Jul 26','Aug 9','Aug 23','Now'] },
        '1y': { points: 13, step: 1, unit: 'mo', labels: ['Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Now'] }
    }[range] || { points: 24, step: 1, unit: 'h', labels: [] };
}

function numericHistory(device, range) {
    
}

export function eventHistory(device, range) {
    
}

export function renderChart(device, range) {
    const numeric = ['temperature','slider','fan'].includes(device.control);
    if (!numeric) {
        const events = eventHistory(device, range);
        const width = 760, height = 190, left = 34, right = 18, top = 22, bottom = 34;
        const innerW = width - left - right, innerH = height - top - bottom;
        const gap = innerW / events.length;
        const bars = events.map((event, i) => {
            const x = left + i * gap + gap * .25;
            const h = event.positive ? 46 : 22;

            return `
                <g>
                    <rect class="history-event-bar ${event.positive ? 'positive':'negative'}" x="${x.toFixed(1)}" y="${(top + innerH - h).toFixed(1)}" width="${Math.max(5, gap * .5).toFixed(1)}" height="${h}" rx="5"></rect>
                    <circle class="history-event-dot ${event.positive ? 'positive':'negative'}" cx="${(x + gap * .25).toFixed(1)}" cy="${(top + innerH - h - 7).toFixed(1)}" r="3"></circle>
                </g>`;
            
        }).join('');

        const labels = events.filter((_, i) => i === 0 || i=== events.length - 1 || i % Math.max(1, Math.floor(events.length / 4)) === 0).map((event, i) => `
            <text x="${(left + i * gap + gap * .25).toFixed(1)}" y="${height - 10}" text-anchor="middle">${i === 0?'Earlier':i === events.length - 1?'Now':event.label.replace('State changed','Changed')}</text>
            `).join('');

        return `
            <div class="history-chart-wrap">
                <div class="history-legend">
                    <span><i class="event-on"></i> State activity</span>
                    <span><i class="event-off"></i> Connection event</span>
                </div>
                <svg class="device-history-svg event-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Device event history for ${range}">
                    <line class="history-gridline" x1="${left}" y1="${top + innerH}" x2="${width - right}" y2="${top + innerH}"/>
                    ${bars}
                    <text class="history-axis-label" x="${left}" y="${top - 6}">EVENTS</text>
                    ${labels}
                </svg>
                <div class="history-event-summary">
                    <strong>${events.filter(e => e.positive).length} state changes</strong>
                    <span>•</span>
                    <strong>${events.filter(e => !e.positive).length} connection events</strong>
                    <span>•</span>
                    <span>Illustrative local history</span>
                </div>
            </div>`;
    }

    const cfg = detailRangeConfig(range);
    const values = numericHistory(device, range);
    const width = 760, height = 210, left = 42, right = 18, top = 18, bottom = 36;
    const min = Math.min(...values), max = Math.max(...values), spread = Math.max(1, max-min);
    const innerW = width - left - right, innerH = height - top - bottom;
    const points = values.map((value, i) => {
        const x = left + (i / (values.length - 1)) * innerW;
        const y = top + (1 - (value - min) / spread) * innerH;
        return [x, y, value];
    });
    const line = points.map((p, i) => `${i?'L':'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L ${points.at(-1)[0].toFixed(1)} ${top + innerH} L ${points[0][0].toFixed(1)} ${top + innerH} Z`;
    const unit = device.control === 'temperature' ? '°C' : device.control === 'fan' ? 'level' : '%';
    const labelIndexes = Array.from(new Set([
        0,
        Math.floor((points.length - 1) * .2),
        Math.floor((points.length - 1) * .4),
        Math.floor((points.length - 1) * .6),
        Math.floor((points.length - 1) * .8),
        points.length-1
    ]));
    const xLabels = labelIndexes.map((idx) => `<text x="${points[idx][0].toFixed(1)}" y="${height - 11}" text-anchor="middle">${cfg.labels[idx] || (idx === points.length - 1?'Now':`Point ${idx + 1}`)}</text>`).join('');
    const yLabels = [0, .5, 1].map((ratio) => {
        const val = max - ratio * spread;
        const y = top + ratio * innerH;
        return `
            <line class="history-gridline" x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}"></line>
            <text class="history-y-label" x="${left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${val.toFixed(device.control === 'temperature'?1:0)}${unit === '%'?'%':''}</text>
        `}).join('');
    const last = points.at(-1);

    return `
        <div class="history-chart-wrap">
            <div class="history-legend">
                <span><i class="history-line-key"></i> ${device.control === 'temperature'?'Temperature':device.control === 'fan'?'Fan level':'Capability level'}</span>
                <strong>${last[2]}${unit === '%'?'%':unit === '°C'?'°C':''} now</strong>
            </div>
            <svg class="device-history-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${device.name} ${range} history">
                <defs>
                    <linearGradient id="historyFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stop-opacity=".30"/>
                        <stop offset="100%" stop-opacity="0"/>
                    </linearGradient>
                </defs>
                ${yLabels}
                <path class="history-area" d="${area}"></path>
                <path class="history-line" d="${line}"></path>
                ${points.map((p, i) => i === points.length - 1?`<circle class="history-point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4"></circle>`:'').join('')}
                ${xLabels}
            </svg>
            <div class="history-event-summary">
                <span>Peak <strong>${max.toFixed(device.control === 'temperature'?1:0)}${unit}</strong></span>
                <span>Low <strong>${min.toFixed(device.control === 'temperature'?1:0)}${unit}</strong></span>
                <span>Range <strong>${range.toUpperCase()}</strong></span>
                <span>Illustrative local history</span>
            </div>
        </div>`;
}

function roomClimateHistory(room, range) {
    const cfg = detailRangeConfig(range);
    const seed = [...String(room.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const temperatureBase = Number.parseFloat(String(roomMetricsForChart(room).temperature)) || 22;
    const humidityBase = Number.parseFloat(String(roomMetricsForChart(room).humidity)) || 50;

    return Array.from({ length: cfg.points }, (_, index) => {
        const wave = Math.sin((index + seed % 9) * 0.55);
        const temperature = temperatureBase + wave * 1.4 + Math.cos(index * 0.21) * 0.5;
        const humidity = humidityBase + Math.cos((index + seed % 5) * 0.43) * 4 + Math.sin(index * 0.17) * 2;
        return {
            temperature: Number(temperature.toFixed(1)),
            humidity: Number(Math.max(20, Math.min(90, humidity)).toFixed(0))
        };
    });
}

function roomMetricsForChart(room) {
    const fallback = {
        'Living Room': ['23°C', '48%'],
        Kitchen: ['22°C', '52%'],
        Bedroom: ['21°C', '50%'],
        Bathroom: ['24°C', '61%'],
        Garage: ['19°C', '57%']
    };
    const values = fallback[room.name] || ['22°C', '50%'];
    return { temperature: room.temperature || values[0], humidity: room.humidity || values[1] };
}

export function renderRoomClimateChart(room, range = '24h') {
    const cfg = detailRangeConfig(range);
    const values = roomClimateHistory(room, range);
    const width = 760;
    const height = 230;
    const left = 48;
    const right = 44;
    const top = 22;
    const bottom = 40;
    const innerW = width - left - right;
    const innerH = height - top - bottom;
    const tempMin = Math.floor(Math.min(...values.map((item) => item.temperature)) - 1);
    const tempMax = Math.ceil(Math.max(...values.map((item) => item.temperature)) + 1);
    const tempSpread = Math.max(2, tempMax - tempMin);
    const points = values.map((item, index) => {
        const x = left + (index / Math.max(1, values.length - 1)) * innerW;
        const tempY = top + (1 - (item.temperature - tempMin) / tempSpread) * innerH;
        const humidityY = top + (1 - (item.humidity - 20) / 70) * innerH;
        return { x, tempY, humidityY, ...item };
    });
    const tempLine = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.tempY.toFixed(1)}`).join(' ');
    const humidityLine = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.humidityY.toFixed(1)}`).join(' ');
    const labels = [0, .2, .4, .6, .8, 1].map((ratio) => {
        const index = Math.round((points.length - 1) * ratio);
        const label = cfg.labels[index] || (index === points.length - 1 ? 'Now' : `Point ${index + 1}`);
        return `<text x="${points[index].x.toFixed(1)}" y="${height - 12}" text-anchor="middle">${label}</text>`;
    }).join('');
    const grid = [0, .5, 1].map((ratio) => {
        const y = top + ratio * innerH;
        const temperature = tempMax - ratio * tempSpread;
        const humidity = 90 - ratio * 70;
        return `<line class="history-gridline" x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}"></line><text class="history-y-label" x="${left - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${temperature.toFixed(0)}°</text><text class="history-y-label" x="${width - right + 8}" y="${(y + 3).toFixed(1)}">${humidity.toFixed(0)}%</text>`;
    }).join('');

    return `<div class="history-chart-wrap room-climate-chart-wrap">
        <div class="history-legend"><span><i class="history-line-key"></i> Temperature</span><span><i class="history-line-key room-humidity-key"></i> Humidity</span><strong>${values.at(-1).temperature}°C · ${values.at(-1).humidity}% now</strong></div>
        <svg class="device-history-svg room-climate-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(room.name)} temperature and humidity history for ${range}">
            ${grid}
            <path class="room-temperature-line" d="${tempLine}"></path>
            <path class="room-humidity-line" d="${humidityLine}"></path>
            ${points.map((point, index) => index === points.length - 1 ? `<circle class="room-temperature-point" cx="${point.x.toFixed(1)}" cy="${point.tempY.toFixed(1)}" r="4"></circle><circle class="room-humidity-point" cx="${point.x.toFixed(1)}" cy="${point.humidityY.toFixed(1)}" r="4"></circle>` : '').join('')}
            ${labels}
        </svg>
        <div class="history-event-summary"><span>Temperature <strong>${Math.min(...values.map((item) => item.temperature)).toFixed(1)}–${Math.max(...values.map((item) => item.temperature)).toFixed(1)}°C</strong></span><span>Humidity <strong>${Math.min(...values.map((item) => item.humidity))}–${Math.max(...values.map((item) => item.humidity))}%</strong></span><span>${range.toUpperCase()}</span></div>
    </div>`;
}

export function bindChartActions({id, device, onReloadPage }) {

    document.querySelectorAll('[data-history-range]').forEach(btn =>
        btn.addEventListener('click', () => {
            device._historyRange = btn.dataset.historyRange;
            onReloadPage();
        }
    ));

}

export function renderHistorySection(device, range) {
    return `
        <section class="settings-card device-history-card">
            <div class="settings-card-header">
                <div class="settings-card-heading">
                    <span class="settings-card-icon">${createIcon('activity')}</span>
                    <div>
                        <h3>History</h3>
                        <p>${['temperature','slider','fan'].includes(device.control) ? 'Capability trend over time.' : 'State and connection events over time.'}</p>
                    </div>
                </div>
                <div class="history-range-tabs" role="tablist">
                    ${['24h','7d','30d','90d','1y'].map(r => `<button type="button" class="${ range === r?'is-active':'' }" data-history-range="${r}" data-device-id="${device.id}" role="tab" aria-selected="${range === r}">${r.toUpperCase()}</button>`).join('')}
                </div>
            </div>
            ${renderChart(device, range)}
        </section>
    `;
}