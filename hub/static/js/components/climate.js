export function renderClimate(data) {
    const temperatureValue = document.querySelector(".temperature-value");
    const temperatureDetail = document.querySelector(".temperature-detail");
    const statusText = document.querySelector(".status-text");
    const statusDot = document.querySelector(".status-badge .status-dot");

    if (!temperatureValue || !temperatureDetail || !statusText || !statusDot) {
        console.error("Climate elements not found in DOM.");
        return;
    }

    if (data.state === "api-offline") {
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "Unavailable";
        statusText.textContent = "API Offline";
        statusDot.style.backgroundColor = "var(--color-danger)";
        return;
    }

    if (data.state === "device-not-found") {
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "No device";
        statusText.textContent = "Unavailable";
        statusDot.style.backgroundColor = "var(--color-warning)";
        return;
    }

    if (data.temperature === null) {
        temperatureValue.textContent = "--";
        temperatureDetail.textContent = "-- °C";
    } else {
        const temperature = Number(data.temperature).toFixed(1);
        temperatureValue.textContent = temperature;
        temperatureDetail.textContent = `${temperature} °C`;
    }

    if (data.online) {
        statusText.textContent = "Online";
        statusDot.style.backgroundColor = "var(--color-success)";
    } else {
        statusText.textContent = "Offline";
        statusDot.style.backgroundColor = "var(--color-danger)";
    }
}