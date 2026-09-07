export const appState = {
    devices: [],
    rooms: [],
    automations: [],
    activity: [],
    apiOnline: false,
    hasLoadedOnce: false,
    userName: "",
    userRole: "",
    // Commands are intentionally kept separate from telemetry. A device can
    // report its old state for a few polling cycles while an MQTT command is
    // still propagating. Keeping the desired value here prevents a 30s poll
    // from visually undoing a successful user action.
    pendingCommands: new Map(),
    favoriteDeviceIds: new Set(loadFavoriteDeviceIds())
};

function loadFavoriteDeviceIds() {
    try {
        const raw = localStorage.getItem("smart-home.favorite-devices");
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

function persistFavoriteDeviceIds() {
    try {
        localStorage.setItem("smart-home.favorite-devices", JSON.stringify([...appState.favoriteDeviceIds]));
    } catch {
        // Favorites remain usable for this session if storage is unavailable.
    }
}

export function isFavoriteDevice(hardwareId) {
    return appState.favoriteDeviceIds.has(String(hardwareId));
}

export function setFavoriteDevice(hardwareId, favorite) {
    const id = String(hardwareId);
    if (favorite) appState.favoriteDeviceIds.add(id);
    else appState.favoriteDeviceIds.delete(id);
    persistFavoriteDeviceIds();
}

export function getFavoriteDevices(devices) {
    return (devices || []).filter(device => isFavoriteDevice(device.hardware_id_hex));
}

export function pendingCommandKey(hardwareId, capability) {
    return `${String(hardwareId)}:${String(capability)}`;
}

export function setPendingCommand(hardwareId, capability, value) {
    appState.pendingCommands.set(pendingCommandKey(hardwareId, capability), {
        value,
        createdAt: Date.now()
    });
}

export function getPendingCommand(hardwareId, capability) {
    return appState.pendingCommands.get(pendingCommandKey(hardwareId, capability));
}

export function clearPendingCommand(hardwareId, capability) {
    appState.pendingCommands.delete(pendingCommandKey(hardwareId, capability));
}
