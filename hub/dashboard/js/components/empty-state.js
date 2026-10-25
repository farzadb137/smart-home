// Reusable empty-state presentation for data-driven dashboard sections.
import { createIcon } from '../icon.js';
import { escapeHtml } from '../util/dom.js';

export function renderEmptyState({
    icon = 'info',
    title = 'Nothing here yet',
    message = '',
    actionLabel = '',
    actionAttribute = '',
    className = ''
} = {}) {
    const action = actionLabel
        ? `<button class="empty-state-action" type="button" ${actionAttribute}>${escapeHtml(actionLabel)}</button>`
        : '';

    return `
        <div class="empty-state ${className}" role="status">
            <span class="empty-state-icon">${createIcon(icon)}</span>
            <strong>${escapeHtml(title)}</strong>
            ${message ? `<p>${escapeHtml(message)}</p>` : ''}
            ${action}
        </div>
    `;
}
