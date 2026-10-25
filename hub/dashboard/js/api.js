const API_BASE = "/api"

async function apiRequest(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Not authenticated");
    }
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `API request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

export async function getHealth() {
    return apiRequest("/health");
}

export async function getSession() {
    return apiRequest("/session");
}

export async function login({ email, password }) {
    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: email, password })
        });
        if (response.ok) return { ok: true, user: email };
        const data = await response.json().catch(() => ({}));
        return { ok: false, error: data.error || "sign in failed"};
    } catch (error) {
        return { ok: false, error: "Could not reach the server"};
    }
}

export async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
}

export async function getUsers() {
    return apiRequest("/users");
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

export async function getDevices() {
    return apiRequest("/devices");
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

export async function getRooms() {
    return apiRequest("/rooms");
}

async function mutateRoom(endpoint, method, payload = undefined) {
    const options = { method, headers: { "Content-Type": "application/json" } };
    if (payload !== undefined) options.body = JSON.stringify(payload);
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    if (response.status === 401) {
        window.location.href = "/login";
        throw new Error("Not authenticated");
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Room request failed: ${response.status}`);
    return body;
}

export async function createRoom(payload) {
    return mutateRoom("/rooms", "POST", payload);
}

export async function assignDeviceToRoom(hardwareIdHex, roomId) {
    return mutateRoom(`/devices/${encodeURIComponent(hardwareIdHex)}/room`, "PUT", { room_id: roomId });
}

export async function getActivity(limit = 100) {
    return apiRequest(`/activity?limit=${encodeURIComponent(limit)}`);
}

export async function startClaim() {
	const response = await fetch("/api/provision/start", { method: "POST" });
	if (response.status === 401) {
		window.location.href = "/login";
		throw new Error("Not authenticated");
	}
	const body = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(body.error || `Start claim failed: ${response.status}`);
	return body;
}