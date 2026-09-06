export const appState = {
    devices: [],
    rooms: [],
    apiOnline: false,
    hasLoadedOnce: false,
    userName: "",
    userRole: "",
    // Commands are intentionally kept separate from telemetry. A device can
    // report its old state for a few polling cycles while an MQTT command is
    // still propagating. Keeping the desired value here prevents a 30s poll
    // from visually undoing a successful user action.
    pendingCommands: new Map()
};

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
