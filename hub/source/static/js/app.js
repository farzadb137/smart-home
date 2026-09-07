import { getHealth, getDevices, getRooms, getActivity, getAutomations, getSession, logout } from "./api.js";
import { appState } from "./state.js";
import { renderTopbar } from "./topbar.js";
import { renderClimate } from "./components/climate.js";
import { renderHomeStatus } from "./components/home-status.js";
import { renderHomeOverview } from "./components/home-overview.js";
import { initRouter, onRouteChange } from "./router.js";
import { initDevicesPage, refreshDevicesPage } from "./devices-page.js";
import { initUsersPage } from "./users-page.js";
import { UI_ICONS } from "./icons.js";
import { initRoomsPage, refreshRoomsPage } from "./rooms-page.js";
import { initDiagnostics } from "./diagnostics.js";
import { initSearch, refreshSearch } from "./search.js";
import { initActivityPage, refreshActivity } from "./activity.js";
import { initAutomationsPage, refreshAutomations } from "./automations-page.js";

// Install before DOM work so browser-injected performance tooling errors are
// handled even if they fire during page startup.
initDiagnostics();

const REFRESH_INTERVAL = 30000;
let dashboardRefreshInFlight = false;

function renderUiIcons() {
    document.querySelectorAll("[data-icon]").forEach(element => {
        const icon = UI_ICONS[element.dataset.icon];
        if (icon) element.innerHTML = icon;
    });
}

function renderStatusIcon(state) {
    const element = document.querySelector("[data-status-icon]");
    if (!element) return;
    const iconName = state === "offline" ? "alert" : state === "warning" ? "alert" : "check";
    element.innerHTML = UI_ICONS[iconName];
}

function getClimateDevice() {
    return appState.devices.find(
        device => device.readings?.temperature
    );
}

function updateDashboard(source = "manual") {
    renderHomeStatus(appState);
    renderStatusIcon(document.querySelector(".home-status-card")?.dataset.state || "normal");
    renderHomeOverview(appState, { source });

    if (!appState.apiOnline) {
        renderClimate({ state: "api-offline" }, { refreshHistory: false });
        if (source !== "poll") renderDevices([]);
        refreshDevicesPage({ source });
        refreshRoomsPage({ source });
        return;
    }

    const climateDevice = getClimateDevice();

    if (!climateDevice) {
        renderClimate({ state: "device-not-found" }, { refreshHistory: false });
    } else {
        renderClimate({
            state: "normal",
            name: climateDevice.name,
            temperature: climateDevice.readings?.temperature?.value ?? null,
            lastUpdated: climateDevice.readings?.temperature?.timestamp ?? null,
            online: climateDevice.online,
            hardwareId: climateDevice.hardware_id_hex
        }, { refreshHistory: source !== "poll" });
    }

    refreshDevicesPage({ source });
    refreshRoomsPage({ source });
}

function updateAdminNavigation() {
    const settingsLink = document.getElementById("admin-settings-link");
    if (settingsLink) {
        settingsLink.style.display = appState.userRole === "administrator" ? "" : "none";
    }
}

async function loadUserSession() {
    try {
        const session = await getSession();
        appState.userName = session.authenticated ? session.username : "";
        appState.userRole = session.authenticated ? session.role : "";
    } catch (error) {
        appState.userName = "";
        appState.userRole = "";
    }
    updateAdminNavigation();
}

async function loadDashboardData() {
    if (dashboardRefreshInFlight) return;
    dashboardRefreshInFlight = true;

    try {
        await getHealth();

        appState.apiOnline = true;
        const [devices, rooms, activity, automations] = await Promise.all([
            getDevices(),
            getRooms(),
            getActivity(8),
            getAutomations()
        ]);
        appState.devices = Array.isArray(devices) ? devices : [];
        appState.rooms = Array.isArray(rooms) ? rooms : [];
        appState.activity = Array.isArray(activity) ? activity : (Array.isArray(activity?.items) ? activity.items : []);
        appState.automations = Array.isArray(automations) ? automations : [];

        refreshSearch();
        updateDashboard(appState.hasLoadedOnce ? "poll" : "initial");

    } catch (error) {
        console.error("Failed to load dashboard data:", error);

        appState.apiOnline = false;

        updateDashboard(appState.hasLoadedOnce ? "poll" : "initial");
    } finally {
        appState.hasLoadedOnce = true;
        dashboardRefreshInFlight = false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    renderUiIcons();
    await loadUserSession();
    renderTopbar(appState.userName);
    initSearch();

    initDevicesPage(onRouteChange);
    initUsersPage();
    initRoomsPage(onRouteChange);
    initActivityPage();
    initAutomationsPage();
    onRouteChange(route => {
        if (route.name === "activity" && route.param === null) refreshActivity(document.getElementById("activity-page"));
        if (route.name === "automations" && route.param === null) refreshAutomations(document.getElementById("automations-page"));
    });
    initRouter();

    document.querySelectorAll("[data-scroll-target]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            const target = document.getElementById(link.dataset.scrollTarget);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    loadDashboardData();

    setInterval(loadDashboardData, REFRESH_INTERVAL);
    setInterval(() => renderTopbar(appState.userName), REFRESH_INTERVAL);
});

document.getElementById("logout-btn")?.addEventListener("click", logout);