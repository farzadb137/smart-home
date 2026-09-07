import { UI_ICONS } from "../icons.js";

function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

function formatDate() {
    return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}

export function renderHomeHero(state) {
    const title = document.getElementById("home-hero-greeting");
    const date = document.getElementById("home-hero-date");
    const automation = document.getElementById("home-hero-automations");
    const rooms = document.getElementById("home-hero-rooms");
    const attention = document.getElementById("home-hero-attention");
    const icon = document.querySelector("[data-home-hero-icon]");
    if (title) title.textContent = greeting();
    if (date) date.textContent = formatDate();
    const devices = Array.isArray(state.devices) ? state.devices : [];
    const roomList = Array.isArray(state.rooms) ? state.rooms : [];
    const automations = Array.isArray(state.automations) ? state.automations : [];
    const offline = devices.filter(device => !device.online).length;
    if (automation) automation.textContent = String(automations.filter(item => item.enabled).length);
    if (rooms) rooms.textContent = String(roomList.length);
    if (attention) attention.textContent = String(offline);
    if (icon) icon.innerHTML = UI_ICONS.home || UI_ICONS.check;
}
