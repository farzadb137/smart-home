const API_BASE = "/api";

async function apiRequestFn(endpoint) {
	const response = await fetch(`${API_BASE}${endpoint}`);
	if (response.status === 401) {
		window.location.href = "/login";
		throw new Error("Not authenticated");
	}
	if(!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.error || `API request failed: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

export async function getHealth() {
	return apiRequestFn("/health");
}

export async function getDevices() {
    return apiRequestFn("/devices");
}

export async function getDevice(hardwareIdHex) {
    return apiRequestFn(`/devices/${encodeURIComponent(hardwareIdHex)}`);
}

export async function getDeviceTelemetry(hardwareIdHex) {
    return apiRequestFn(`/devices/${encodeURIComponent(hardwareIdHex)}/telemetry`);
}

export async function getSession() {
	return apiRequestFn("/session");
}

export async function sendDeviceCommand(hardwareIdHex, command, data) {
	const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(hardwareIdHex)}/command`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ command, data })
	});
	if (response.status === 401) {
		window.location.href = "/login";
		throw new Error("Not authenticated");
	}
	if (!response.ok) {
		const errorBody = await response.json().catch(() => ({}));
		throw new Error(errorBody.error || `Command failed: ${response.status}`);
	}
	return response.json();
}

export async function renameDevice(hardwareIdHex, name) {
	const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(hardwareIdHex)}/rename`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name })
	});
	if (response.status === 401) {
		window.location.href = "/login";
		throw new Error("Not authenticated");
	}
	const body = await response.json().catch(() => ({}));
	if (!response.ok || body.success === false)
		throw new Error(body.error || `Rename failed: ${response.status}`);
	return body;
}

export async function uploadFirmware(hardwareIdHex, file) {
	const formData = new FormData();
	formData.append("firmware", file);

	const response = await fetch(`${API_BASE}/devices/${encodeURIComponent(hardwareIdHex)}/firmware`, {
		method: "POST",
		body: formData
	});
	if (response.status === 401) {
		window.location.href = "/login";
		throw new Error("Not authenticated");
	}
	const body = await response.json().catch(() => ({}));
	if (!response.ok || body.success === false)
		throw new Error(body.error || body.data?.message || `Firmware update failed: ${response.status}`);
	return body;
}

export async function logout() {
	await fetch("/api/logout", { method: "POST" });
	window.location.href = "/login";
}

export async function getUsers() {
	return apiRequestFn("/users");
}

async function mutateUser(endpoint, method, payload = undefined) {
	const options = { method, headers: { "Content-Type": "application/json" } };
	if (payload != undefined) options.body = JSON.stringify(payload);
	const response = await fetch(`${API_BASE}${endpoint}`, options);
	if (response.status === 401) {
		window.location.href = "/login";
		throw new Error("Not authenticated");
	}
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(body.error || `User request failed: ${response.status}`);
	return body;
}

export async function createUser(payload) {
	return mutateUser("/users", "POST", payload);
}

export async function updateUser(userId, payload) {
	return mutateUser(`/users/${encodeURIComponent(userId)}`, "PUT", payload);
}

export async function deleteUser(userId) {
	return mutateUser(`/users/${encodeURIComponent(userId)}`, "DELETE");
}

export { apiRequestFn };