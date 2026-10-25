// Reusable information table/grid renderer.
import { createIcon } from '../icon.js';
import { escapeHtml } from '../util/dom.js';

export function renderInfoTable(rows, options = {}) {
    const title = options.title || '';
    const icon = options.icon || 'info';

    return `
        <section class="settings-card info-table-card">
            ${title
                ? `<div class="settings-card-header"><div class="settings-card-heading"><span class="settings-card-icon">${createIcon(icon)}</span><div><h3>${escapeHtml(title)}</h3></div></div></div>`
                : ''
            }
            <div class="settings-info-grid">
                ${rows.map((row) => `<div class="settings-info"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(String(row.value ?? '—'))}</strong></div>`).join('')}
            </div>
        </section>`;
}

export function renderInfoRows(rows) {
    return rows.map((row) => `<div class="settings-info"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(String(row.value ?? '—'))}</strong></div>`).join('');
}
