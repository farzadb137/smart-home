const API_BASE = "/api";

async function apiRequest(endpoint) {
	const response = await fetch(`${API_BASE}${endpoint}`);
	if(!response.ok)
		throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	return response.json();
}

export async function getHealth() {
	return apiRequest("/health");
}

export async function getDevices() {
    return apiRequest("/devices");
}

export async function getDevice(deviceName) {
    return apiRequest(`/devices/${encodeURIComponent(deviceName)}`);
}

export async function getDeviceTelemetry(deviceName) {
    return apiRequest(
        `/devices/${encodeURIComponent(deviceName)}/telemetry`
    );
}