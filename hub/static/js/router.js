const listeners = [];

function currentRoute() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    return { name: parts[0] || "overview", param: parts[1] || null };
}

function dispatch() {
    const route = currentRoute();

    document.querySelectorAll(".view").forEach(view => {
        view.style.display = (view.dataset.view === route.name) ? "" : "none";
    });
    document.querySelectorAll(".nav-item[data-route]").forEach(link => {
        link.classList.toggle("active", link.dataset.route === route.name);
    });

    listeners.forEach(callback => callback(route));
}

export function onRouteChange(callback) {
    listeners.push(callback);
}

export function initRouter() {
    window.addEventListener("hashchange", dispatch);
    dispatch();
}