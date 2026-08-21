import { getHealth, getDevices } from "./api.js";
import { appState } from "./state.js";

const REFRESH_INTERVAL = 30000;

function getClimateDevice() {
    return appState.devices.find(
        device => device.temperature !== null
    );
}

function renderClimate(data) {
    const temperatureValue = document.querySelector(".temperature-value");
    const temperatureDetail = document.querySelector(".temperature-detail");
    const statusText = document.querySelector(".status-text");
    const statusDot = document.querySelector(".status-badge .status-dot");

    if (!temperatureValue || !temperatureDetail || !statusText || !statusDot) {
        console.error("Climate elements not found in DOM.");
        return;
    }

    if (data.temperature === null || Number.isNaN(data.temperature)) {
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "-- °C";
    } else {
        temperatureValue.textContent = data.temperature.toFixed(1);
        temperatureDetail.textContent =
            `${data.temperature.toFixed(1)} °C`;
    }

    if (data.online) {
        statusText.textContent = "Online";
        statusDot.style.backgroundColor = "var(--color-success)";
    } else {
        statusText.textContent = "Offline";
        statusDot.style.backgroundColor = "var(--color-danger)";
    }
}

function updateDashboard() {
    const climateDevice = getClimateDevice();

    if (!climateDevice) {
        console.warn("No climate device found.");
        return;
    }

    renderClimate({
        temperature:
            climateDevice.temperature !== null
                ? Number(climateDevice.temperature)
                : null,

        online: Boolean(climateDevice.online)
    });
}

async function loadDashboardData() {
    try {
        await getHealth();

        appState.apiOnline = true;
        appState.devices = await getDevices();

        console.log("Dashboard data:", appState);

        updateDashboard();

    } catch (error) {
        console.error("Failed to load dashboard data:", error);

        appState.apiOnline = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();

    setInterval(loadDashboardData, REFRESH_INTERVAL);
});