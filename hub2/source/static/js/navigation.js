import { renderIcons } from "./icon.js";
import { renderHomePage } from "./pages/home-page.js";
import { renderDevicesPage } from "./pages/devices-page.js";
import { renderDeviceDetailPage } from "./pages/device-detail-page.js";
import { renderRoomsPage } from "./pages/rooms-page.js";
import { renderRoomDetailPage } from "./pages/room-detail-page.js";
import { renderActivityPage } from "./pages/activity-page.js";
import { renderSettingsPage } from "./pages/settings-page.js";

function updateNavigation(view) {
  const section = view.split("/")[0];
  document.querySelectorAll("[data-view]").forEach((item) => {
    const active = item.dataset.view === view || item.dataset.view === section;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
}

export function navigate(view) {
  updateNavigation(view);
  if (view === "home") renderHomePage();
  else if (view === "rooms") renderRoomsPage();
  else if (view === "devices") renderDevicesPage();
  else if (view === "activity") renderActivityPage();
  else if (view === "settings") renderSettingsPage();
  else if (view.startsWith("device/")) renderDeviceDetailPage(view.slice(7));
  else if (view.startsWith("room/")) renderRoomDetailPage(view.slice(5));
  else
    document.querySelector("#app").innerHTML =
      `<section class="settings-view"><div class="settings-hero"><div><span class="settings-eyebrow">NEXT VIEW</span><h2>${view}</h2><p>This view is ready for a future module.</p></div></div></section>`;
  renderIcons();
}

export function handleNavigation(e) {
  const target = e.target.closest("[data-view]");
  if (!target) return;
  e.preventDefault();
  const view = target.dataset.view;
  if (view) {
    history.replaceState(null, "", `#${view}`);
    navigate(view);
  }
}
