function formatDeviceName(name) {
    return name.replaceAll("_", " ").replace(/\b\w/g, character =>
            character.toUpperCase()
        );
}

export function renderDevices(devices) {
    const container = document.querySelector(".devices-list");

    if (!container) {
        console.error("Devices container not found in DOM.");
        return;
    }

    container.innerHTML = "";

    devices.forEach(device => {
        const item = document.createElement("div");

        item.classList.add("device-item");

        item.innerHTML = `
            <div class="device-info">
                <strong>${formatDeviceName(device.name)}</strong>
                <small>${device.online ? "Online" : "Offline"}</small>
            </div>

            <div class="device-temperature">
                ${device.temperature ?? "--"} °C
            </div>
        `;

        container.append(item);
    });
}