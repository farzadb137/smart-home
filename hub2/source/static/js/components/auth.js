// Authentication domain module.
// This client-side implementation is suitable for the static demo only.
// Replace the storage-backed adapter with the API authentication service later.

import { getSession } from '../api.js';
import { appstate } from '../state.js';

export function hasAdminAccount() {
    return appstate.users.some((account) => account.role === 'administrator');
}

export async function isAuthenticated() {
    let session;
    try {
        session = await getSession();
    } catch (err) {
        console.error("getSession failed:", err);
        session = { authenticated: false };
    }

    const { authenticated, username = "", role = "" } = session;

    appstate.session.isAuthenticated = authenticated;
    appstate.session.name = authenticated ? username : "";
    appstate.session.role = authenticated ? role : "";

    return authenticated;
}

export function getLoginRedirect() {
    return hasAdminAccount() ? 'login.html' : 'admin-login.html';
}
