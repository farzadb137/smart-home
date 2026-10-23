import { createIcon } from '../icon.js';
import { appstate } from '../state.js';
import { renderRoomCards, renderRoomStats, ROOM_TYPES } from '../components/room.js';
import { escapeHtml } from '../util/dom.js';
import { createRoom } from '../api.js';

let query = '';

function filteredRooms() {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return appstate.rooms;
    return appstate.rooms.filter((room) => `${room.name} ${room.id}`.toLowerCase().includes(normalized));
}

export function renderRoomsPage() {
    const rooms = filteredRooms();
    const app = document.querySelector('#app');
    app.innerHTML = `<section class="rooms-page">
        <header class="rooms-page-header">
            <div>
                <span class="settings-eyebrow">HOME ORGANIZATION</span>
                <h2>Rooms</h2>
                <p>Monitor every room, see its devices, and open a dedicated room view.</p>
            </div>
            <div class="rooms-page-actions">
                <label class="rooms-search">
                    <span>${createIcon('search')}</span>
                    <input type="search" value="${escapeHtml(query)}" placeholder="Search rooms..." aria-label="Search rooms" data-room-search>
                </label>
                <button class="settings-button" type="button" data-add-room>${createIcon('plus')} Add room</button>
            </div>
        </header>
        ${renderRoomStats()}
        <section class="rooms-page-list" aria-labelledby="all-rooms-title">
            <div class="rooms-page-list-header">
                <div><h3 id="all-rooms-title">All rooms</h3><span>${rooms.length} of ${appstate.rooms.length} rooms</span></div>
            </div>
            <div class="rooms-grid rooms-page-grid">${renderRoomCards(rooms, appstate.rooms.length && !rooms.length ? { title: 'No rooms found', message: 'Try a different room name or clear the search.' } : {})}</div>
        </section>
    </section>`;

    bindRoomsPage(app);
}

function bindRoomsPage(app) {
    app.querySelector('[data-room-search]')?.addEventListener('input', (event) => {
        query = event.target.value;
        const rooms = filteredRooms();
        const roomList = document.querySelector(".rooms-page-list .rooms-page-grid");
        roomList.innerHTML = `
            ${renderRoomCards(rooms, appstate.rooms.length && !rooms.length ? { title: 'No rooms found', message: 'Try a different room name or clear the search.' } : {})}`;
    });

    app.querySelector('[data-add-room]')?.addEventListener('click', openAddRoom);
}


function openAddRoom() {
    const backdrop = document.createElement('div');
    backdrop.className = 'rooms-modal-backdrop';
    backdrop.innerHTML = `
        <div class="rooms-modal" role="dialog" aria-modal="true" aria-labelledby="add-room-title">
            <div class="rooms-modal-header">
                <div><span class="settings-eyebrow">NEW ROOM</span><h3 id="add-room-title">Add room</h3></div>
                <button type="button" class="rooms-modal-close" data-close>${createIcon('plus')}</button>
            </div>
            <form class="rooms-modal-form" data-add-room-form>
                <label>Room name<input name="name" required maxlength="40" placeholder="e.g. Office"></label>
                <label>Room type<select name="type">${ROOM_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}</select></label>
            </form>
            <div class="rooms-modal-actions"><button type="button" class="settings-button-secondary" data-close>Cancel</button><button type="button" class="settings-button" data-save-room>Create room</button></div>
        </div>`;
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    backdrop.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', close));
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    backdrop.querySelector('[data-save-room]').addEventListener('click', async () => {
        const form = backdrop.querySelector('[data-add-room-form]');
        if (!form.reportValidity()) return;
        const data = new FormData(form);
        const name = String(data.get('name')).trim();
        const type = String(data.get('type')).trim();
        try {
            const result = await createRoom({name, type});
            if (result.room) appstate.rooms.push(result.room);
        } catch (error) {
            
        }
        close();
        renderRoomsPage();
    });
}
