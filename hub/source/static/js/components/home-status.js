export function renderHomeStatus(state) {
    const card = document.querySelector(".home-status-card");
    const title = document.getElementById("home-status-title");
    const summary = document.getElementById("home-status-summary");
    const detail = document.getElementById("home-status-detail");
    const sidebar = document.getElementById("sidebar-status-text");

    if (!card || !title || !summary || !detail) return;

    if (!state.apiOnline) {
        apply(card, title, summary, detail, sidebar, "offline", "Hub unavailable", "The dashboard cannot reach the smart-home API.", "API connection offline", "Hub connection unavailable");
        return;
    }

    const total = state.devices.length;
    const online = state.devices.filter(device => device.online).length;
    const offline = total - online;

    if (offline > 0) {
        apply(card, title, summary, detail, sidebar, "warning", "Attention needed", `${online} of ${total} devices are online.`, `${offline} device${offline === 1 ? "" : "s"} offline`, `${online}/${total} devices online`);
        return;
    }

    apply(
        card,
        title,
        summary,
        detail,
        sidebar,
        "normal",
        total ? "Home is looking good" : "Home is ready",
        total ? `${total} device${total === 1 ? "" : "s"} online. No issues detected.` : "No devices connected yet.",
        total ? "All systems normal" : "Waiting for devices",
        total ? "All systems normal" : "No devices connected"
    );
}

function apply(card, title, summary, detail, sidebar, state, titleText, summaryText, detailText, sidebarText) {
    card.dataset.state = state;
    title.textContent = titleText;
    summary.textContent = summaryText;
    detail.textContent = detailText;
    if (sidebar) sidebar.textContent = sidebarText;
}
