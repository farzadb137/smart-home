// Activity domain module. Rendering and activity mutations live here so pages only orchestrate the UI.
import { createIcon } from '../icon.js';
import { appstate } from '../state.js';
import { escapeHtml } from '../util/dom.js';
import { renderEmptyState } from './empty-state.js';

export function activityCategory(item) {
    if (item.type) return item.type;
    if (['login', 'logout', 'user'].includes(item.eventType)) return 'user';
    if (['warning', 'alert', 'error'].includes(item.tone)) return 'system';
    if (['warning', 'notifications'].includes(item.icon)) return 'system';
    return item.deviceId ? 'device' : 'system';
}

export function activityCategoryLabel(category) {
    return { all: 'All events', device: 'Device actions', system: 'System events', user: 'User actions' }[category] || 'Activity';
}

export function activityMatchesQuery(item, query = '') {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [item.message, item.room, item.time, item.icon, item.category, item.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
}

export function renderActivityItem(item) {
    const category = activityCategory(item);
    const device = appstate.devices.find((entry) => String(entry.hardware_id_hex) === String(item.hardware_id_hex));
    const detail = device ? `${device.type} · ${device.name}` : item.room_name || activityCategoryLabel(category);

    return `
        <article class="activity-item" data-activity-id="${escapeHtml(String(item.id))}">
            <span class="activity-icon activity-icon-${item.tone || 'primary'}">${createIcon(item.icon || 'activity')}</span>
            <div class="activity-copy"><strong>${escapeHtml(item.message || 'Activity event')}</strong><span>${escapeHtml(detail)}</span></div>
            <time>${escapeHtml(item.created_at || 'Recently')}</time>
            <span class="activity-dot activity-dot-${item.tone || 'primary'}"></span>
        </article>`;
}

export function renderActivityList(items, emptyOptions = {}) {
    if (!items.length) {
        return renderEmptyState({
            icon: emptyOptions.icon || 'activity',
            title: emptyOptions.title || 'No activity yet',
            message: emptyOptions.message || 'Activity will appear here.'
        });
    }

    return items.map(renderActivityItem).join('');
}

export function renderRecentActivity() {
    const content = renderActivityList(appstate.activities.slice(0, 5), {
        icon: 'logs',
        title: 'No activity yet',
        message: 'Device events and system activity will appear here.'
    });

    return `
        <section class="activity-section dashboard-panel" aria-labelledby="activity-title">
            <div class="dashboard-panel-header">
                <div class="dashboard-panel-heading"><span class="dashboard-panel-icon">${createIcon('logs')}</span><div><h2 id="activity-title" class="dashboard-panel-title">Recent Activity</h2><p class="dashboard-panel-subtitle">Latest events around your home</p></div></div>
                <a class="dashboard-panel-link" href="#activity" data-view="activity">View all activities ${createIcon('arrow-up-right')}</a>
            </div>
            <div class="activity-list" data-recent-activity>${content}</div>
        </section>`;
}

export function addActivity(item) {
    
}
