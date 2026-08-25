function formatDeviceName(name) {
    return name
        .replaceAll("_", " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );
}

function getDeviceValue(device) {
    switch (device.type) {
        case "Temperature Node": {
            const value = device.readings?.temperature?.value;
            return value === undefined || value === null
                ? "--"
                : `${Number(value).toFixed(1)} °C`;
        }
        case "Smart Switch": {
            const value = device.readings?.switch?.value;
            return value ? "On" : "Off";
        }
        case "Door Sensor": {
            const value = device.readings?.contact?.value;
            return value ? "Open" : "Closed";
        }
        default:
            return "Unknown";
    }
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
                <strong>
                    ${formatDeviceName(device.name)}
                </strong>

                <small>
                    ${device.online ? "Online" : "Offline"}
                </small>
            </div>

            <div class="device-value">
                ${getDeviceValue(device)}
            </div>
        `;

        container.append(item);
    });
}