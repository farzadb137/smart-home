// Theme domain module.
import { appstate, updateSettings } from "../state.js";
import { createIcon } from "../icon.js";

const THEMES = [
  ["dark", "Midnight", "Deep blue"],
  ["ocean", "Ocean", "Cool teal"],
  ["graphite", "Graphite", "Neutral dark"],
  ["light", "Light", "Bright & clean"],
];

export function getTheme() {
  return (
    appstate.settings.theme ||
    localStorage.getItem("smarthome-theme-v1") ||
    "dark"
  );
}

export function setTheme(theme) {
  const next = THEMES.some((t) => t[0] === theme) ? theme : "dark";
  updateSettings({ theme: next });
  document.documentElement.dataset.theme = next === "dark" ? "" : next;
  if (next === "dark") document.documentElement.removeAttribute("data-theme");
  localStorage.setItem("smarthome-theme-v1", next);
}

export function renderTheme() {
  const selected = getTheme();
  return `<section class="settings-card" id="settings-appearance"><div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon("palette")}</span><div><h3>Appearance & themes</h3><p>Choose the visual style used throughout your smart-home dashboard.</p></div></div></div><div class="theme-grid">${THEMES.map(([id, name, desc]) => `<button type="button" class="theme-option${selected === id ? " is-selected" : ""}" data-theme-option="${id}" aria-pressed="${selected === id}"><div class="theme-preview ${id}"><div class="theme-preview-bar"></div><div class="theme-preview-grid"><span></span><span></span></div></div><div class="theme-option-info"><div><strong>${name}</strong><span>${desc}</span></div><span class="theme-check">${createIcon("check-circle")}</span></div></button>`).join("")}</div></section>`;
}

export function bindTheme(root = document, onChange = () => {}) {
  root.querySelectorAll("[data-theme-option]").forEach((b) =>
    b.addEventListener("click", () => {
      setTheme(b.dataset.themeOption);
      onChange();
    }),
  );
}
