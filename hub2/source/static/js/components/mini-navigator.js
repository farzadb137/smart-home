// Reusable local navigator for tabs/sections.
import { createIcon } from '../icon.js';
export function renderMiniNavigator(items, active, label='Sections'){
 return `<nav class="settings-nav mini-navigator" aria-label="${label}"><span class="settings-nav-label">${label.toUpperCase()}</span>${items.map(i=>`<button type="button" class="${i.id===active?'is-active':''}" data-mini-nav="${i.id}">${i.icon?createIcon(i.icon):''}${i.label}</button>`).join('')}</nav>`;
}
export function bindMiniNavigator(root=document,onChange=()=>{}){
 root.querySelectorAll('[data-mini-nav]').forEach(b=>b.addEventListener('click',()=>onChange(b.dataset.miniNav)));
}
