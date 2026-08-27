import { getHealth, getDevices, logout } from "./api.js";
import { appState } from "./state.js";
import { renderTopbar } from "./topbar.js";
import { renderClimate } from "./components/climate.js";
import { renderDevices } from "./components/devices.js";

const REFRESH_INTERVAL = 30000;
const USER_NAME = "Farzad";

function getClimateDevice() {
    return appState.devices.find(
        device => device.readings?.temperature
    );
}

function updateDashboard() {
    if (!appState.apiOnline) {
        renderClimate({
            state: "api-offline"
        });
        renderDevices([]);
        return;
    }

    const climateDevice = getClimateDevice();

    if (!climateDevice) {
        renderClimate({
            state: "device-not-found"
        });
        return;
    }

    renderClimate({
        state: "normal",
        name: climateDevice.name,
        temperature: climateDevice.readings?.temperature?.value ?? null,
        lastUpdated: climateDevice.readings?.temperature?.timestamp ?? null,
        online: climateDevice.online
    });
    renderDevices(appState.devices);
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

        updateDashboard();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderTopbar(USER_NAME)
    loadDashboardData();

    setInterval(loadDashboardData, REFRESH_INTERVAL);
    setInterval(() => renderTopbar(USER_NAME), REFRESH_INTERVAL);
});

document.getElementById("logout-btn")?.addEventListener("click", logout);