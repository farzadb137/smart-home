import { appstate } from './state.js';
import { getTheme, setTheme } from './components/theme.js';
import { isAuthenticated} from './components/auth.js';
import { handleNavigation, navigate } from './navigation.js';
import { getActivity, getDevices, getHealth, getRooms, getUsers, logout } from './api.js';
import { initials } from './util/dom.js';
import { getCity, updateWeather } from './components/weather.js';
import { createIcon } from './icon.js';

const REFRESH_INTERVAL = 30000;
const WEATHER_REFRESH_INTERVAL = 10 * 60 * 1000;

const GREETING_PERIODS = [
    { untilHour: 5, text: "Good Night" },
    { untilHour: 12, text: "Good Morning" },
    { untilHour: 18, text: "Good Afternoon" },
    { untilHour: 22, text: "Good Evening" },
];

function getGreeting(date) {
    const hour = date.getHours();
    const period = GREETING_PERIODS.find(p => hour < p.untilHour);
    return period ? period.text : "Good Night";
}

function updateHeaderClock() {
    const now = new Date();

    const time = document.querySelector(".header-time");
    if (time)
        time.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const date = document.querySelector(".header-meta-label");
    if (date)
        date.textContent = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

    const greeting = document.querySelector(".header-welcome h1");
    if (greeting && appstate.session.isAuthenticated) {
        const name = appstate.session.name || "";
        const displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
        greeting.textContent = `${getGreeting(now)}, ${displayName}`;
    }
}

function updateDashboard() {
    const deivceCount = appstate.devices.length;
    const offline = appstate.devices.filter((device) => !device.online).length;
    const roomCount = appstate.rooms.length;

    const icon = document.getElementById("status-icon");
    const text = document.getElementById("status-text");
    if (icon && text) {
        if (!appstate.apiOnline) {
            icon.innerHTML = createIcon("x-circle");
            icon.style.color = "var(--color-danger)";
            text.style.color = "var(--color-danger)";
            text.textContent = "API Offline";
        } else {
            icon.innerHTML = createIcon("check-circle");
            icon.style.color = "var(--color-success)";
            text.style.color = "var(--color-success)";
            text.textContent = "System healthy";
        }
    }

    const systemStatus = document.querySelector(".header-welcome p");
    if (systemStatus)
        systemStatus.textContent = !appstate.apiOnline ? "The dashboard cannot reach the smart-home API." : offline ? "Some devices need attention" : (deivceCount ? "Your smart home is running smoothly." : "Your home is ready for devices.");

    const accountAvatar = document.querySelector(".account-avatar");
    const accountName = document.querySelector('.account-details strong');
    const accountRole = document.querySelector('.account-details span');
    if (accountAvatar && accountName && accountRole && appstate.session.isAuthenticated) {
        accountAvatar.textContent = initials(appstate.session.name);
        accountName.textContent = appstate.session.name;
        accountRole.textContent = appstate.session.role;
    }

    const totalDevices = document.getElementById("total-devices");
    const totalRooms = document.getElementById("total-rooms");
    const offlineDevices = document.getElementById("offline-devices");
    if (totalDevices && totalRooms && offlineDevices) {
        totalDevices.textContent = deivceCount;
        totalRooms.textContent = roomCount;
        offlineDevices.textContent = offline;
    }
}

async function loadDashboardData() {
    try {
        await getHealth();
        appstate.apiOnline = true;
        const [users, devices, rooms, activity] = await Promise.all([
            getUsers(),
            getDevices(),
            getRooms(),
            getActivity(8)
        ]);
        appstate.users = Array.isArray(users)?users:[];
        appstate.devices = Array.isArray(devices)?devices:[];
        appstate.rooms = Array.isArray(rooms)?rooms:[];
        appstate.activities = Array.isArray(activity)?activity:[];
        updateDashboard();
    } catch (error) {
        console.error("Failed to load dashboard data:", error);
        appstate.apiOnline = false;
        updateDashboard();
    } finally {

    }
}

document.addEventListener('DOMContentLoaded', async () => {

    if (!(await isAuthenticated())) {
        window.location.replace('login.html');
        return;
    }

    setTheme(getTheme());
    document.addEventListener('click', handleNavigation);
    document.querySelector('.logout-button')?.addEventListener('click', logout);
    document.getElementById("city-input").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const cityName = e.target.value.trim();
            if (cityName)
                updateWeather({ cityName, latitude: "", longitude: "", label: "" });
            e.target.blur();
        }
    });

    await loadDashboardData();
    await updateWeather(getCity());

    navigate(location.hash.slice(1) || 'home');

    updateHeaderClock();

    setInterval(updateHeaderClock, 1000);
    setInterval(loadDashboardData, REFRESH_INTERVAL);
    setInterval(() => updateWeather(getCity()), WEATHER_REFRESH_INTERVAL);
});

window.addEventListener('hashchange', async () => {
    if (await isAuthenticated()) navigate(location.hash.slice(1) || 'home');
});
