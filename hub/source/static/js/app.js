import { getHealth, getDevices, getSession, logout } from "./api.js";
import { appState } from "./state.js";
import { renderTopbar } from "./topbar.js";
import { renderClimate } from "./components/climate.js";
import { renderDevices } from "./components/devices.js";
import { initRouter, onRouteChange } from "./router.js";
import { initDevicesPage, refreshDevicesPage } from "./devices-page.js";

const REFRESH_INTERVAL = 30000;

function getClimateDevice() {
    return appState.devices.find(
        device => device.readings?.temperature
    );
}

function updateDashboard() {
    if (!appState.apiOnline) {
        renderClimate({ state: "api-offline" });
        renderDevices([]);
        refreshDevicesPage();
        return;
    }

    const climateDevice = getClimateDevice();

    if (!climateDevice) {
        renderClimate({ state: "device-not-found" });
    } else {
        renderClimate({
            state: "normal",
            name: climateDevice.name,
            temperature: climateDevice.readings?.temperature?.value ?? null,
            lastUpdated: climateDevice.readings?.temperature?.timestamp ?? null,
            online: climateDevice.online,
            hardwareId: climateDevice.hardware_id_hex
        });
    }

    renderDevices(appState.devices);
    refreshDevicesPage();
}

async function loadUserSession() {
    try {
        const session = await getSession();
        appState.userName = session.authenticated ? session.username : "";
    } catch (error) {
        appState.userName = "";
    }
}

async function loadDashboardData() {
    try {
        await getHealth();

        appState.apiOnline = true;
        appState.devices = await getDevices();

        updateDashboard();

    } catch (error) {
        console.error("Failed to load dashboard data:", error);

        appState.apiOnline = false;

        updateDashboard();
    } finally {
        appState.hasLoadedOnce = true;
        refreshDevicesPage();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await loadUserSession();
    renderTopbar(appState.userName);

    initDevicesPage(onRouteChange);
    initRouter();

    loadDashboardData();

    setInterval(loadDashboardData, REFRESH_INTERVAL);
    setInterval(() => renderTopbar(appState.userName), REFRESH_INTERVAL);
});

document.getElementById("logout-btn")?.addEventListener("click", logout);