import { appState } from "./state.js";

function renderEmptyState(container) {
    container.innerHTML = `
        <section class="page-header">
            <div>
                <p class="card-label">YOUR HOME</p>
                <h1>Rooms</h1>
                <p class="page-header-summary">Organize devices by the spaces where they belong.</p>
            </div>
        </section>

        <section class="card page-empty-card">
            <div class="empty-state page-empty-state">
                <span class="empty-state-icon" aria-hidden="true">□</span>
                <div>
                    <strong>No rooms configured yet</strong>
                    <p>Rooms will become the main way to browse and control your home. The backend room model can be connected here without changing the dashboard layout.</p>
                </div>
            </div>
        </section>
    `;
}

export function initRoomsPage() {
    const container = document.getElementById("rooms-page");
    if (!container) return;

    renderEmptyState(container);
}

export function refreshRoomsPage() {
    const container = document.getElementById("rooms-page");
    if (!container) return;

    if (!Array.isArray(appState.rooms) || appState.rooms.length === 0) {
        renderEmptyState(container);
    }
}
