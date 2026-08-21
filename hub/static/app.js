async function loadDevices() {

    try {
        const response = await fetch("/api/devices");
        if (!response.ok) {
            throw new Error("API request failed");
        }
        const devices = await response.json();
        document.getElementById("api-status").textContent = "API Connected";
        renderDevices(devices);
    } catch (error) {
        console.error(error);
        document.getElementById("api-status").textContent = "API Offline";
    }
}

function renderDevices(devices) {

    const container = document.getElementById("devices");
    container.innerHTML = "";
    if (devices.length === 0) {
        container.innerHTML = "<p>No devices found.</p>";
        return;
    }

    for (const device of devices) {
        const card = document.createElement("div");
        card.className = "device-card";
        const statusClass = device.online?"online":"offline";
        const statusText = device.online?"ONLINE":"OFFLINE";
        card.innerHTML = `
            <div class="device-header">

                <div class="device-name">
                    ${device.name}
                </div>

                <div class="status ${statusClass}">
                    ${statusText}
                </div>

            </div>
            <div class="metrics">

                <div class="metric">
                    <div class="metric-label">
                        Temperature
                    </div>

                    <div class="metric-value">
                        ${device.temperature ?? "--"} °C
                    </div>
                </div>

                <div class="metric">
                    <div class="metric-label">
                        RSSI
                    </div>

                    <div class="metric-value">
                        ${device.rssi ?? "--"} dBm
                    </div>
                </div>

                <div class="metric">
                    <div class="metric-label">
                        Uptime
                    </div>

                    <div class="metric-value">
                        ${device.uptime ?? "--"} s
                    </div>
                </div>

                <div class="metric">
                    <div class="metric-label">
                        Device ID
                    </div>

                    <div class="metric-value">
                        ${device.id}
                    </div>
                </div>

            </div>

            <div class="firmware">
                Firmware: ${device.firmware ?? "--"}
            </div>
        `;

        container.appendChild(card);
    }
}


loadDevices();
