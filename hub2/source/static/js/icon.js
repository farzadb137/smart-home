// Smart Home Dashboard - SVG icon set

const stroke = 'currentColor';

export const ICONS = Object.freeze({
    home: `<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>`,
    rooms: `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`,
    devices: `<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M9 7h6M9 17h6"/><circle cx="12" cy="13" r="1"/>`,
    automation: `<path d="m13 2-9 11h7l-1 9 9-12h-7z"/>`,
    energy: `<path d="m13 2-8 11h6l-1 9 9-12h-6z"/>`,
    security: `<path d="M12 3 19 6v5c0 4.7-2.9 8.2-7 10-4.1-1.8-7-5.3-7-10V6z"/><path d="m9 12 2 2 4-4"/>`,
    settings: `<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 3.7 12a2 2 0 0 0-.7-1.4l-.1-.1A2 2 0 1 1 5.7 7.7l.1.1A2 2 0 0 0 9.2 6.4V6.2a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a2 2 0 0 0 0 3.4Z"/>`,
    logs: `<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>`,
    notifications: `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>`,
    internet: `<path d="M3 8.5a14 14 0 0 1 18 0"/><path d="M6.5 12a9 9 0 0 1 11 0"/><path d="M10 15.5a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1"/>`,
    hub: `<rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8M8 13h5M8 16h2"/><circle cx="16.5" cy="15.5" r="1"/>`,
    power: `<path d="M12 3v9"/><path d="M7.2 5.7a7 7 0 1 0 9.6 0"/>`,
    battery: `<rect x="3" y="7" width="17" height="10" rx="2"/><path d="M21 10v4"/><path d="M6 10h8v4H6z"/>`,
    logout: `<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>`,
    brand: `<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>`,
    calendar: `<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 9h18"/>`,
    weather: `<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.5 4.5 0 0 0 7 18Z"/><path d="M7 21h10"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>`,
    moon: `<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>`,
    "cloud-sun": `<circle cx="16" cy="8" r="3"/><path d="M16 3v2M16 11v2M11 8h2M19 8h2M12.5 4.5l1.4 1.4M18.1 10.1l1.4 1.4"/><path d="M5 19h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 5 12a3.5 3.5 0 0 0 0 7Z"/>`,
    "cloud-fog": `<path d="M5 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 4 8a4 4 0 0 0 1 6Z"/><path d="M3 18h14M6 21h11"/>`,
    "cloud-drizzle": `<path d="M5 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 4 8a4 4 0 0 0 1 6Z"/><path d="M8 17v2M12 17v2M16 17v2"/>`,
    "cloud-rain": `<path d="M5 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 4 8a4 4 0 0 0 1 6Z"/><path d="m8 17-1 3M12 17l-1 3M16 17l-1 3"/>`,
    "cloud-snow": `<path d="M5 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 4 8a4 4 0 0 0 1 6Z"/><path d="M8 18h.01M12 18h.01M16 18h.01M8 21h.01M12 21h.01M16 21h.01"/>`,
    "cloud-lightning": `<path d="M5 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 4 8a4 4 0 0 0 1 6Z"/><path d="m13 15-3 5h3l-1 4 5-7h-3l2-4Z"/>`,
    location: `<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>`,
    search: `<circle cx="11" cy="11" r="6.5"/><path d="m16 16 5 5"/>`,
    "check-circle": `<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>`,
    "x-circle": `<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>`,
    "living-room": `<path d="M5 11V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2"/><path d="M4 11h16a2 2 0 0 1 2 2v4H2v-4a2 2 0 0 1 2-2Z"/><path d="M5 17v2M19 17v2"/>`,
    kitchen: `<path d="M4 20V7h16v13"/><path d="M7 7V4h3v3M14 7V4h3v3M7 12h10M7 16h6"/>`,
    bedroom: `<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 15h18M5 10V7h5a2 2 0 0 1 2 2v1M3 18v2M21 18v2"/>`,
    bathroom: `<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z"/><path d="M7 12V6a3 3 0 0 1 5.5-1.5M4 19v2M20 19v2"/>`,
    garage: `<path d="M3 20V9l9-6 9 6v11"/><path d="M6 13h12v7H6zM6 16h12"/>`,
    light: `<path d="M9 18h6M10 21h4"/><path d="M8 14.5a6 6 0 1 1 8 0c-.9.7-1.2 1.4-1.3 2.5H9.3c-.1-1.1-.4-1.8-1.3-2.5Z"/>`,
    fan: `<circle cx="12" cy="12" r="2"/><path d="M12 10c-1-4 1-6 3.5-5.5C18 5 16 9 13.5 11M10 12c-4 1-6-1-5.5-3.5C5 6 9 8 11 10.5M12 14c1 4-1 6-3.5 5.5C6 19 8 15 10.5 13M14 12c4-1 6 1 5.5 3.5C19 18 15 16 13 13.5"/>`,
    tv: `<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>`,
    speaker: `<rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="9" r="2"/><circle cx="12" cy="15.5" r="3"/>`,
    thermostat: `<rect x="8" y="3" width="8" height="18" rx="4"/><path d="M12 7v6M12 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/>`,
    'lock-open': `<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/><path d="M12 14v3"/>`,
    lock: `<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>`,
    camera: `<path d="M4 8h4l2-2h4l2 2h4v10H4z"/><circle cx="12" cy="13" r="3"/>`,
    temperature: `<path d="M14 14.8V6a2 2 0 0 0-4 0v8.8a4 4 0 1 0 4 0Z"/><path d="M12 9v7"/>`,
    humidity: `<path d="M12 3s6 6.1 6 10a6 6 0 1 1-12 0c0-3.9 6-10 6-10Z"/>`,
    "arrow-up-right": `<path d="M7 17 17 7M8 7h9v9"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    close: `<path d="M6 6l12 12M18 6 6 18"/>`,
    'arrow-left': `<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>`,
    edit: `<path d="m4 16.5-.8 3.3 3.3-.8L18.9 6.6a2.2 2.2 0 0 0-3.1-3.1L3.4 15.9Z"/><path d="m14.5 5.5 4 4"/>`,
    trash: `<path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 14h10l1-14"/>`,
    user: `<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>`,
    shield: `<path d="M12 3 19 6v5c0 4.7-2.9 8.2-7 10-4.1-1.8-7-5.3-7-10V6z"/>`,
    key: `<circle cx="8" cy="15" r="3"/><path d="m10.5 12.5 8-8M15 7l2 2M17 5l2 2"/>`,
    cloud: `<path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 9.5 4.5 4.5 0 0 0 7 18Z"/><path d="M12 13v5M9.5 15.5 12 18l2.5-2.5"/>`,
    palette: `<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="1" fill="currentColor" stroke="none"/><path d="M17.5 14.5c0 1.1-.9 2-2 2H14a2 2 0 0 1-2-2c0-1.1-.9-2-2-2H8"/>`,
    database: `<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>`,
    activity: `<path d="M3 12h4l2-6 4 12 2-6h6"/>`,
    warning: `<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/>`,
    download: `<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>`,
    mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`,
    eye: `<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>`,
});

export function createIcon(name, className = '') {
    const paths = ICONS[name];

    if (!paths) {
        return '';
    }

    const classes = ['icon', className].filter(Boolean).join(' ');

    return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export function renderIcons(root = document) {
    root.querySelectorAll('[data-icon]').forEach((element) => {
        const name = element.dataset.icon;

        if (!ICONS[name]) {
            console.warn(`Unknown icon: ${name}`);
            return;
        }

        element.innerHTML = createIcon(name);
        element.removeAttribute('data-icon');
    });
}
