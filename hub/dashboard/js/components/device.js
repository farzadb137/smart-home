// Device domain module: data access, cards, controls, quick actions and device mutations.
import { createIcon } from "../icon.js";
import { appstate } from "../state.js";
import { escapeHtml, clamp } from "../util/dom.js";
import { renderEmptyState } from "./empty-state.js";

export function deviceById(id) {
  return appstate.devices.find((d) => String(d.id) === String(id));
}

export function deviceCapability(d) {
  if (d.type === "Smart Switch") return d.readings.switch.value ? "On" : "Off";
  if (d.type === "Smart Door") return d.readings.contact.value ? "Open" : "Close";
  if (d.type === "Temperature Node") return `${d.readings.temperature.value}°C`;
}

export function deviceIcon(d) {
  if (d.type === "Smart Switch") return "light";
  if (d.type === "Smart Door") return "lock";
  if (d.type === "Temperature Node") return "temperature";
}

export function deviceSignal(d) {
  if (d.rssi >= -50) return 'Excellent';
  if (d.rssi >= -60) return 'Good';
  if (d.rssi >= -70) return 'Fair';
  if (d.rssi >= -80) return 'Weak';
  return 'Very Weak';
}

export function loadDevices() {
  return appstate.devices;
}

export function saveDevices() {
  return appstate.devices;
}

export function toggleDevice(id) {
  const d = deviceById(id);
  if (!d || !d.online) return false;
  //updateInCollection('devices', id, { value: !d.value }); return true;
}

export function stepDevice(id, step) {
  const d = deviceById(id);
  if (!d) return false;
  let value;
  if (d.control === "temperature")
    value = clamp(Number(d.value) + Number(step), 16, 30);
  else if (d.control === "fan")
    value = clamp(Number(d.value) + Number(step), 0, 3);
  else return false;
  //updateInCollection('devices', id, { value }); return true;
}

export function setDeviceValue(id, value) {
  const d = deviceById(id);
  if (!d) return false;
  //updateInCollection('devices', id, { value: Number(value) }); return true;
}

export function deviceControl(d, compact = false) {
  if (d.type === "Smart Switch") {
    const isOn = Boolean(d.readings.switch.value);
    const label = isOn ? "On" : "Off";
    const icon = "power";
    const stateClass = isOn ? "is-active" : "is-inactive";
    return `
        <button class="device-binary-control ${stateClass} ${d.control === "lock" ? "is-lock" : "is-power"}" type="button" role="switch" aria-checked="${isOn}" aria-label="${escapeHtml(d.name)}: ${label}" data-device-toggle="${d.id}">
            <span class="device-binary-icon">${createIcon(icon)}</span>
            <span class="device-binary-label">${label}</span>
            <span class="device-binary-track" aria-hidden="true"><i></i></span>
        </button>`;
  }
  if (d.type === "Smart Door") {
    const isOn = Boolean(d.readings.contact.value);
    const label = isOn ? "Close" : "Open";
    const icon = isOn ? "lock" : "lock-open";
    const stateClass = isOn ? "is-active" : "is-inactive";
    return `
        <button class="device-binary-control ${stateClass} ${d.control === "lock" ? "is-lock" : "is-power"}" type="button" role="switch" aria-checked="${isOn}" aria-label="${escapeHtml(d.name)}: ${label}" data-device-toggle="${d.id}">
            <span class="device-binary-icon">${createIcon(icon)}</span>
            <span class="device-binary-label">${label}</span>
            <span class="device-binary-track" aria-hidden="true"><i></i></span>
        </button>`;
  }
  if (d.type === "Temperature Node")
    return `
        <div class="device-stepper">
            <button type="button" data-temp="${d.id}" data-step="-1">−</button>
            <strong>${d.readings.temperature.value}°C</strong>
            <button type="button" data-temp="${d.id}" data-step="1">+</button>
        </div>`;
  return `<span class="device-capability-status">${escapeHtml(deviceCapability(d))}</span>`;
}

export function renderDeviceCard(d, options = {}) {
    if (options.compact)
        return `
            <article class="quick-action-card ${d.online ? "" : "is-offline"}" data-device-id="${d.id}">
                <span class="quick-action-icon">${createIcon(deviceIcon(d))}</span>
                <div class="quick-action-copy"><strong>${escapeHtml(d.name)}</strong><span>${escapeHtml(d.room)}</span><em>${escapeHtml(deviceCapability(d))}</em></div>
                ${deviceControl(d, true)}
            </article>`;
        
    const selection = options.selection ? " checked" : "";
    const selectControl = options.showSelect
        ? `<div class="device-select"><input type="checkbox" data-device-select="${escapeHtml(d.id)}"${selection} aria-label="Select ${escapeHtml(d.name)}"></div>`
        : "";
    const name = options.showLink
        ? `<a class="device-name" href="#device/${encodeURIComponent(d.id)}" data-view="device/${encodeURIComponent(d.id)}">${escapeHtml(d.name)}</a>`
        : `<span class="device-name">${escapeHtml(d.name)}</span>`;
    return `
        <article class="device-list-card ${d.online ? "" : "is-offline"}" data-device-id="${escapeHtml(d.id)}">
            ${selectControl}
            <div class="device-type">
                <span class="device-type-icon">${createIcon(deviceIcon(d))}</span>
                <div><strong>${escapeHtml(d.type)}</strong><span class="device-online ${d.online ? "" : "is-offline"}"><i></i>${d.online ? "Online" : "Offline"}</span></div>
            </div>
            <div class="device-main">${name}<span class="device-room">${createIcon("rooms")} ${escapeHtml(d.room_name)}</span></div>
            <div class="device-capability"><span>Current value</span><strong>${escapeHtml(deviceCapability(d))}</strong></div>
            <div class="device-control"><span>Control</span>${deviceControl(d)}</div>
            <button class="device-more" type="button" data-device-more="${d.id}">•••</button>
        </article>`;
}

export function renderDeviceCards(devices, options = {}) {
  return devices.map((d) => renderDeviceCard(d, options)).join("");
}

export function renderQuickActions() {
  const ids = [
    "living-main-light",
    "bedroom-fan",
    "kitchen-pendants",
    "living-thermostat",
    "front-door-lock",
    "garage-camera",
  ];
  return `<section class="quick-actions-section dashboard-panel" aria-labelledby="quick-actions-title">
        <div class="dashboard-panel-header"><div class="dashboard-panel-heading"><span class="dashboard-panel-icon">${createIcon("automation")}</span><div><h2 id="quick-actions-title" class="dashboard-panel-title">Quick Actions</h2><p class="dashboard-panel-subtitle">Control your most used devices</p></div></div><a class="dashboard-panel-link" href="#devices" data-view="devices">View all devices ${createIcon("arrow-up-right")}</a></div>
        <div class="quick-actions-grid${ids.map(deviceById).filter(Boolean).length ? "" : " is-empty"}" data-quick-actions>${(() => {
          const devices = ids.map(deviceById).filter(Boolean);
          return devices.length
            ? renderDeviceCards(devices, { compact: true })
            : renderEmptyState({
                icon: "automation",
                title: "No quick actions yet",
                message:
                  "Add devices to make frequently used controls available here.",
              });
        })()}</div>
    </section>`;
}

export function bindDeviceControls(root = document) {
  root.querySelectorAll("[data-device-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      if (!toggleDevice(button.dataset.deviceToggle)) return;
      const device = deviceById(button.dataset.deviceToggle);
      const isActive = Boolean(device?.value);
      button.setAttribute("aria-checked", String(isActive));
      button.classList.toggle("is-active", isActive);
      const label = button.querySelector(".device-binary-label, strong");
      if (label && device)
        label.textContent = device.control === "lock" ? (isActive ? "Locked" : "Unlocked") : (isActive ? "On" : "Off");
      root.dispatchEvent(new CustomEvent("device:changed", { bubbles: true }));
    }),
  );

  root.querySelectorAll("[data-device-slider]").forEach((input) =>
    input.addEventListener("input", () => {
      setDeviceValue(input.dataset.deviceSlider, input.value);
      const output = input.nextElementSibling;
      if (output) output.value = `${input.value}%`;
      root.dispatchEvent(new CustomEvent("device:changed", { bubbles: true }));
    }),
  );

  root.querySelectorAll("[data-temp],[data-fan]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.temp || button.dataset.fan;
      if (!stepDevice(id, button.dataset.step)) return;
      const device = deviceById(id);
      const container = button.parentElement;
      const value = container?.querySelector("strong");
      if (value && device)
        value.textContent =
          device.control === "temperature"
            ? `${device.value}°C`
            : `Level ${device.value}`;
      root.dispatchEvent(new CustomEvent("device:changed", { bubbles: true }));
    }),
  );
}

export function addDevice(device) {
  //return addToCollection('devices', device, { prepend: true });
}

export function updateDevice(id, patch) {
  //return updateInCollection('devices', id, patch);
}

export function removeDevice(id) {
  // return removeFromCollection('devices', id);
}

export function assignDevicesToRoom(ids, room) {
  // ids.forEach(id => updateInCollection('devices', id, { room }));
  // return ids.map(deviceById).filter(Boolean);
}
