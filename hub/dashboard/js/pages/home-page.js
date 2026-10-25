import { renderRooms } from "../components/room.js";
import { renderQuickActions, bindDeviceControls } from "../components/device.js";
import { renderRecentActivity } from "../components/activity.js";


export function renderHomePage() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    ${renderRooms()}
    <section class="dashboard-lower-grid" aria-label="Home controls and recent activity">
      ${renderQuickActions()}
      ${renderRecentActivity()}
    </section>`;

  bindDeviceControls(app);
  
  app.addEventListener("device:changed", () => {
      /* local state is already updated */
    },
    { once: true },
  );
}
