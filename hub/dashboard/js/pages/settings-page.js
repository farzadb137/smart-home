import { createIcon } from "../icon.js";
import { renderTheme, bindTheme } from "../components/theme.js";
import { renderUsers, bindUsers } from "../components/user.js";
import { renderMiniNavigator, bindMiniNavigator } from "../components/mini-navigator.js";
import { renderSystemSettings } from "../components/system.js";
import { appstate } from "../state.js";

let section = "appearance";

const sections = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "users", label: "Users & access", icon: "user" },
  { id: "notifications", label: "Notifications", icon: "notifications" },
  { id: "system", label: "System", icon: "settings" },
];

function renderNotifications() {
  return `
    <section class="settings-card" id="settings-notifications">
      <div class="settings-card-header">
        <div class="settings-card-heading">
          <span class="settings-card-icon">${createIcon("notifications")}</span>
          <div><h3>Notifications</h3><p>Choose which events should interrupt you and where.</p></div>
        </div>
      </div>${[
        [ "security", "Security alerts", "Notify for unlocked doors, alarms, and unexpected motion." ],
        [ "deviceStatus", "Device status changes", "Show alerts when important devices go offline or recover." ]
      ].map(
        ([key, t, p]) =>
        `<div class="settings-toggle-row">
          <div class="settings-toggle-copy"><strong>${t}</strong><span>${p}</span></div>
          <button class="settings-switch" data-notification="${key}" role="switch" aria-checked="${appstate.settings.notifications[key]}"><span></span></button>
        </div>`,
      ).join("")}
    </section>`;
}

export async function renderSettingsPage() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <section class="settings-view">
      <div class="settings-hero">
        <div><span class="settings-eyebrow">SYSTEM CONTROL</span><h2>Settings</h2><p>Manage how your home looks, who can access it, and how the system behaves.</p></div>
        <span class="settings-save-state">Changes saved automatically</span>
      </div>
      <div class="settings-layout">
        ${renderMiniNavigator(sections, section, "Settings")}
        <div class="settings-sections">
          ${renderTheme()}
          ${renderUsers()}
          ${renderNotifications()}
          ${renderSystemSettings()}
        </div>
      </div>
    </section>`;
  
  bindMiniNavigator(app, (s) => {
    section = s;
    document.querySelector(`#settings-${s}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    renderSettingsPage();
  });
  bindTheme(app, renderSettingsPage);
  bindUsers(app, renderSettingsPage);

  app.querySelectorAll("[data-notification]").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.notification;
      //updateNotification(k, !appstate.settings.notifications[k]);
      renderSettingsPage();
    }),
  );
}
