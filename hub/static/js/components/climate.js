import { CAPABILITY_ICONS } from "../icons.js";
import { formatDeviceName, formatRelativeTime } from "../utils.js";

export function renderClimate(data) {
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
        return;
    }

    if (data.state === "device-not-found") {
        roomEl.textContent = "No Sensor";
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "No device";
        if (lastUpdatedValue) lastUpdatedValue.textContent = "--";
        statusText.textContent = "Unavailable";
        statusDot.style.backgroundColor = "var(--color-warning)";
        return;
    }

    roomEl.textContent = formatDeviceName(data.name);

    if (data.temperature === null || data.temperature === undefined) {
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "-- °C";
    } else {
        const temperature = Number(data.temperature).toFixed(1);
        temperatureValue.textContent = temperature;
        temperatureDetail.textContent = `${temperature} °C`;
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
}