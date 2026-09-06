import { CAPABILITY_ICONS } from "../icons.js";
import { formatDeviceName, formatRelativeTime } from "../utils.js";
import { fetchDeviceHistory, renderHistoryChart } from "../history.js";

let currentChart = null;
let currentRange = "24h";
let currentHardwareId = null;

const GAUGE_MIN = 10;
const GAUGE_MAX = 35;
const GAUGE_SWEEP_DEG = 300; // 360 - 60deg gap, centered at the bottom

function buildGaugeSvg(value) {
    const r = 62;
    const circumference = 2 * Math.PI * r;
    const sweepLen = circumference * (GAUGE_SWEEP_DEG / 360);
    const gapLen = circumference - sweepLen;

    const fraction = value === null
        ? 0
        : Math.min(1, Math.max(0, (value - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)));
    const valueLen = sweepLen * fraction;

    return `
        <svg viewBox="0 0 140 140">
            <defs>
                <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge>
                        <feMergeNode in="blur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <g transform="rotate(120 70 70)">
                <circle cx="70" cy="70" r="${r}" fill="none"
                    stroke="rgba(255,255,255,0.07)" stroke-width="10"
                    stroke-linecap="round"
                    stroke-dasharray="${sweepLen} ${gapLen}"/>
                <circle cx="70" cy="70" r="${r}" fill="none"
                    stroke="#e6a15c" stroke-width="10"
                    stroke-linecap="round"
                    stroke-dasharray="${valueLen} ${circumference - valueLen}"
                    filter="url(#gauge-glow)"/>
            </g>
        </svg>
    `;
}

function renderGauge(value) {
    const gaugeEl = document.querySelector(".climate-gauge");
    if (!gaugeEl)
        return;

    gaugeEl.innerHTML = buildGaugeSvg(value) +
        `<span class="climate-gauge-bound min">${GAUGE_MIN}°C</span>
         <span class="climate-gauge-bound max">${GAUGE_MAX}°C</span>`;
}

async function loadAndRenderHistory(hardwareIdHex, range) {
    const canvas = document.querySelector(".climate-history-canvas");
    if (!canvas)
        return;

    try {
        const points = await fetchDeviceHistory(hardwareIdHex, "temperature", range);

        if (currentChart) {
            currentChart.destroy();
            currentChart = null;
        }

        currentChart = renderHistoryChart(canvas, points, range);
    } catch (error) {
        console.error("Failed to load temperature history:", error);
    }
}

function wireRangeButtons(hardwareIdHex) {
    document.querySelectorAll(".range-btn").forEach(button => {
        button.onclick = () => {
            document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            currentRange = button.dataset.range;
            loadAndRenderHistory(hardwareIdHex, currentRange);
        };
    });
}

export function renderClimate(data, options = {}) {
    const roomEl = document.querySelector(".climate-room");
    const iconEl = document.querySelector(".climate-card-icon");
    const temperatureValue = document.querySelector(".temperature-value");
    const temperatureDetail = document.querySelector(".temperature-detail");
    const lastUpdatedValue = document.querySelector(".last-updated-value");
    const statusText = document.querySelector(".status-text");
    const statusDot = document.querySelector(".status-badge .status-dot");

    if (!roomEl || !temperatureValue || !temperatureDetail || !statusText || !statusDot) {
        console.error("Climate elements not found in DOM.");
        return;
    }

    if (iconEl)
        iconEl.innerHTML = CAPABILITY_ICONS.temperature;

    if (data.state === "api-offline") {
        roomEl.textContent = "Unavailable";
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "Unavailable";
        if (lastUpdatedValue) lastUpdatedValue.textContent = "--";
        statusText.textContent = "API Offline";
        statusDot.style.backgroundColor = "var(--color-danger)";
        renderGauge(null);
        return;
    }

    if (data.state === "device-not-found") {
        roomEl.textContent = "No Sensor";
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "No device";
        if (lastUpdatedValue) lastUpdatedValue.textContent = "--";
        statusText.textContent = "Unavailable";
        statusDot.style.backgroundColor = "var(--color-warning)";
        renderGauge(null);
        return;
    }

    roomEl.textContent = formatDeviceName(data.name);

    if (data.temperature === null || data.temperature === undefined) {
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "-- °C";
        renderGauge(null);
    } else {
        const temperature = Number(data.temperature).toFixed(1);
        temperatureValue.textContent = temperature;
        temperatureDetail.textContent = `${temperature} °C`;
        renderGauge(Number(data.temperature));
    }

    if (lastUpdatedValue)
        lastUpdatedValue.textContent = formatRelativeTime(data.lastUpdated);

    if (data.online) {
        statusText.textContent = "Online";
        statusDot.style.backgroundColor = "var(--color-success)";
    } else {
        statusText.textContent = "Offline";
        statusDot.style.backgroundColor = "var(--color-danger)";
    }

    if (data.hardwareId) {
        if (data.hardwareId !== currentHardwareId) {
            currentHardwareId = data.hardwareId;
            wireRangeButtons(data.hardwareId);
        }
        if (options.refreshHistory !== false) {
            loadAndRenderHistory(data.hardwareId, currentRange);
        }
    }
}