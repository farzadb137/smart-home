import { getHealth, getDevices } from "./api.js";
import { appState } from "./state.js";
import { renderClimate } from "./components/climate.js";
import { renderDevices } from "./components/devices.js";

const REFRESH_INTERVAL = 30000;

const CLIMATE_DEVICE = "TEMP-DEFAULT-0001";

function getClimateDevice() {
    return appState.devices.find(
        device => device.name === CLIMATE_DEVICE
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
        temperature: climateDevice.temperature,
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
    loadDashboardData();

    setInterval(loadDashboardData, REFRESH_INTERVAL);
});