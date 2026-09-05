// Capability -> icon SVG markup. Shared between the device card
// grid and any capability-specific hero cards, so a capability's
// visual identity stays consistent across the dashboard.

export const CAPABILITY_ICONS = {
    humidity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z"/><path d="M9.5 15.5a3 3 0 0 0 5 0"/></svg>`,
    brightness: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
    target_temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 18h.01M19 8h2M19 12h2M19 16h2"/></svg>`,
    temperature: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><circle cx="12" cy="18" r="1"/></svg>`,
    switch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v4M15 2v4M6 6h12v4a6 6 0 0 1-12 0V6Z"/><path d="M12 16v6"/></svg>`,
    contact: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="12" height="18" rx="1"/><circle cx="14" cy="12" r="1"/></svg>`,
};

export const DEFAULT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/></svg>`;
export const UI_ICONS = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
    rooms: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>`,
    devices: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/><circle cx="15" cy="16" r="1"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1-1.8 3.1-.2-.1-2.2-.9a7.7 7.7 0 0 1-2.1 1.2l-.3 2.4H11l-.3-2.4a7.7 7.7 0 0 1-2.1-1.2l-2.2.9-.2.1-1.8-3.1.1-.1 1.9-1.5a7.8 7.8 0 0 1 0-2.4L4.5 9.6l-.1-.1 1.8-3.1.2.1 2.2.9a7.7 7.7 0 0 1 2.1-1.2L11 3.8h2l.3 2.4a7.7 7.7 0 0 1 2.1 1.2l2.2-.9.2-.1 1.8 3.1-.1.1-1.9 1.5a7.8 7.8 0 0 1 0 2.4L19.4 15Z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/></svg>`,
    activity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>`,
    room: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M4 21h16M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/></svg>`,
};
