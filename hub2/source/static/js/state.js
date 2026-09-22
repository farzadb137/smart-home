
export const appstate = {
    users: [],
    devices: [],
    rooms: [],
    activities: [],
    apiOnline: false,
    session: {
        isAuthenticated: "",
        name: "",
        email: "",
        role: ""
    },
    settings: {
        theme: 'dark',
        location: { cityName: "", latitude: "", longitude: "", label: "" },
        notifications: { security: true, deviceStatus: true }
    },
    ui: {
        deviceFilters: { query: '', room: 'all', type: 'all', status: 'all' }
    }
};

export function updateSettings(patch) {
    Object.assign(appstate.settings, patch);
    return appstate.settings;
}

export function updateDeviceFilters(patch) {
    Object.assign(appstate.ui.deviceFilters, patch);
    return appstate.ui.deviceFilters;
}
