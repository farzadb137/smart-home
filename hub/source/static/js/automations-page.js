import { getAutomations, createAutomation, updateAutomation, deleteAutomation, runAutomation } from "./api.js";
import { appState } from "./state.js";
import { UI_ICONS } from "./icons.js";

let initialized = false;
let loading = false;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const selectedDevice = id => appState.devices.find(d => d.hardware_id_hex === id);
const deviceLabel = d => `${d.name || d.hardware_id_hex}${d.room_name ? ` · ${d.room_name}` : ""}`;
const capabilities = d => Object.keys(d?.readings || {}).filter(Boolean);
const operators = [["eq","is"],["neq","is not"],["gt",">"],["gte",">="],["lt","<"],["lte","<="]];
const numericCaps = new Set(["temperature","humidity","brightness","target_temperature"]);

function deviceOptions(selected = "", blank = true) {
    return `${blank ? '<option value="">Choose device…</option>' : ""}${appState.devices.map(d => `<option value="${esc(d.hardware_id_hex)}" ${d.hardware_id_hex === selected ? "selected" : ""}>${esc(deviceLabel(d))}</option>`).join("")}`;
}
function capOptions(deviceId, selected = "") {
    return `<option value="">Choose capability…</option>${capabilities(selectedDevice(deviceId)).map(c => `<option value="${esc(c)}" ${c === selected ? "selected" : ""}>${esc(c.replace(/_/g," "))}</option>`).join("")}`;
}
function opOptions(selected = "eq") { return operators.map(([v,l]) => `<option value="${v}" ${v === selected ? "selected" : ""}>${l}</option>`).join(""); }
function valueFrom(raw, capability) {
    if (numericCaps.has(capability)) { const n = Number(raw); return Number.isFinite(n) ? n : raw; }
    const v = String(raw).trim().toLowerCase();
    return ["true","1","on","yes"].includes(v);
}
function describe(a) {
    const c = a.config || {}, t = c.trigger || {}, actions = Array.isArray(c.actions) ? c.actions : (c.action ? [c.action] : []);
    if (t.type === "schedule") return `Every day at ${esc(t.time || "--:--")}`;
    const d = selectedDevice(t.hardware_id_hex), op = operators.find(x => x[0] === t.operator)?.[1] || t.operator || "is";
    return `When ${d ? deviceLabel(d) : t.hardware_id_hex || "device"} · ${t.capability || "value"} ${op} ${esc(t.value)}`;
}

function ruleMeta(a) {
    const c = a.config || {}, t = c.trigger || {};
    const actions = Array.isArray(c.actions) ? c.actions : (c.action ? [c.action] : []);
    const conditions = Array.isArray(c.conditions) ? c.conditions : [];
    const triggerLabel = t.type === "schedule" ? "Schedule" : (t.type === "numeric" ? "Sensor" : "State");
    return { triggerLabel, actionCount: actions.length, conditionCount: conditions.length };
}

function render(root, automations) {
    const enabled = automations.filter(a => a.enabled).length;
    const scheduled = automations.filter(a => (a.config?.trigger?.type || "") === "schedule").length;
    const reactive = automations.length - scheduled;
    root.innerHTML = `<div class="page-header automation-page-header"><div><p class="card-label">AUTOMATION</p><h1>Automations</h1><p>Build rules that react to devices or run on a schedule.</p></div><button class="button button-primary" type="button" data-new-automation>${UI_ICONS.plus || "＋"}<span>Create automation</span></button></div>
    <div class="automation-summary" aria-label="Automation summary"><div><strong>${automations.length}</strong><span>Total rules</span></div><div><strong>${enabled}</strong><span>Enabled</span></div><div><strong>${reactive}</strong><span>Device rules</span></div><div><strong>${scheduled}</strong><span>Schedules</span></div></div>
    <div class="automation-list">${automations.length ? automations.map(a => { const m=ruleMeta(a); return `<article class="card automation-card"><div class="automation-card-main"><div class="automation-card-icon">${UI_ICONS.automation || UI_ICONS.activity}</div><div class="automation-card-copy"><div class="automation-card-title-row"><h2>${esc(a.name)}</h2><span class="automation-status ${a.enabled ? "is-enabled" : ""}"><span></span>${a.enabled ? "Enabled" : "Disabled"}</span></div><div class="automation-rule-line"><span class="automation-rule-pill">${esc(m.triggerLabel)}</span><span>${describe(a)}</span><span class="automation-rule-arrow">→</span><span>${m.actionCount} action${m.actionCount === 1 ? "" : "s"}</span>${m.conditionCount ? `<span>· ${m.conditionCount} condition${m.conditionCount === 1 ? "" : "s"}</span>` : ""}</div>${a.last_triggered_at ? `<small class="automation-last-run">Last run ${esc(a.last_triggered_at)}</small>` : `<small class="automation-last-run">Never run</small>`}</div></div><div class="automation-card-actions"><button class="button" type="button" data-toggle-id="${a.id}">${a.enabled ? "Disable" : "Enable"}</button><button class="button" type="button" data-run-id="${a.id}" ${a.enabled ? "" : "disabled"}>Run now</button><button class="button" type="button" data-edit-id="${a.id}">Edit</button><button class="button button-danger" type="button" data-delete-id="${a.id}">Delete</button></div></article>`; }).join("") : `<section class="card"><div class="empty-state"><span class="empty-state-icon">${UI_ICONS.automation || UI_ICONS.activity}</span><div><strong>No automations yet</strong><p>Create a rule for a device event or a daily schedule.</p></div></div></section>`}</div>`;
    root.querySelector("[data-new-automation]")?.addEventListener("click", () => showEditor(root));
    root.querySelectorAll("[data-edit-id]").forEach(b => b.addEventListener("click", () => { const a=automations.find(x=>String(x.id)===b.dataset.editId); if(a) showEditor(root,a); }));
    root.querySelectorAll("[data-toggle-id]").forEach(b => b.addEventListener("click", async()=>{const a=automations.find(x=>String(x.id)===b.dataset.toggleId); if(!a)return; try{await updateAutomation(a.id,{name:a.name,enabled:!a.enabled,config:a.config});await refreshAutomations(root);}catch(e){alert(e.message);}}));
    root.querySelectorAll("[data-run-id]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{const r=await runAutomation(b.dataset.runId);if(r?.partial) alert(`Automation completed with some action failures. Check Activity for details.`);await refreshAutomations(root);}catch(e){alert(e.message);b.disabled=false;}}));
    root.querySelectorAll("[data-delete-id]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Delete this automation?"))return;try{await deleteAutomation(b.dataset.deleteId);await refreshAutomations(root);}catch(e){alert(e.message);}}));
}

function actionRow(action = {}, index = 0) {
    const d = action.hardware_id_hex || "", cap = action.data?.name || "", value = action.data?.value ?? "";
    return `<div class="automation-row automation-action-row" data-action-row><div class="automation-row-number">${index + 1}</div><label>Device<select data-field="device" required>${deviceOptions(d)}</select></label><label>Capability<select data-field="capability" required>${capOptions(d,cap)}</select></label><label>Value<input data-field="value" required value="${esc(value)}" placeholder="1, 50, on…"></label><button class="button button-danger automation-remove" type="button" data-remove-action aria-label="Remove action">${UI_ICONS.close || "×"}</button></div>`;
}
function conditionRow(condition = {}, index = 0) {
    const d=condition.hardware_id_hex || "", cap=condition.capability || "";
    return `<div class="automation-row" data-condition-row><div class="automation-row-number">${index + 1}</div><label>Device<select data-field="device">${deviceOptions(d)}</select></label><label>Capability<select data-field="capability">${capOptions(d,cap)}</select></label><label>Operator<select data-field="operator">${opOptions(condition.operator)}</select></label><label>Value<input data-field="value" value="${esc(condition.value ?? "")}" placeholder="25"></label><button class="button button-danger automation-remove" type="button" data-remove-condition aria-label="Remove condition">${UI_ICONS.close || "×"}</button></div>`;
}
function showEditor(root, automation = null) {
    const c=automation?.config || {}, t=c.trigger || {}, actions=Array.isArray(c.actions) ? c.actions : (c.action ? [c.action] : []);
    root.innerHTML=`<div class="page-header"><div><p class="card-label">${automation?"EDIT AUTOMATION":"NEW AUTOMATION"}</p><h1>${automation?"Edit automation":"Create automation"}</h1><p>Use a trigger, optional conditions, and one or more actions.</p></div></div>
    <form class="card automation-editor" data-automation-form><label class="automation-name-field">Name<input name="name" maxlength="80" required placeholder="Turn lights on at sunset" value="${esc(automation?.name||"")}"></label>
    <section class="automation-step"><span class="automation-step-number">1</span><div class="automation-step-body"><div class="automation-section-head"><div><p class="card-label">WHEN</p><h3>Trigger</h3></div></div><div class="form-grid"><label>Trigger type<select name="trigger_type"><option value="state">Device state</option><option value="numeric">Sensor value</option><option value="schedule">Daily schedule</option></select></label><label class="trigger-device-field">Device<select name="trigger_device">${deviceOptions(t.hardware_id_hex)}</select></label><label class="trigger-cap-field">Capability<select name="trigger_capability"><option value="">Choose capability…</option></select></label><label class="trigger-op-field">Operator<select name="trigger_operator">${opOptions(t.operator)}</select></label><label class="trigger-value-field">Value<input name="trigger_value" placeholder="1 or 24.5" value="${esc(t.value??"")}"></label><label class="trigger-time-field">Time<input name="trigger_time" type="time" value="${esc(t.time||"")}"></label></div></div></section>
    <section class="automation-step"><span class="automation-step-number">2</span><div class="automation-step-body"><div class="automation-section-head"><div><p class="card-label">IF</p><h3>Conditions <span class="optional-label">Optional · all must match</span></h3></div><button class="button" type="button" data-add-condition>+ Add condition</button></div><div class="automation-rows" data-conditions>${(c.conditions||[]).map(conditionRow).join("")}</div><div class="automation-empty-row" data-condition-empty>No extra conditions</div></div></section>
    <section class="automation-step"><span class="automation-step-number">3</span><div class="automation-step-body"><div class="automation-section-head"><div><p class="card-label">THEN</p><h3>Actions</h3></div><button class="button" type="button" data-add-action>+ Add action</button></div><div class="automation-rows" data-actions>${actions.map(actionRow).join("")}</div></div></section>
    <div class="automation-editor-actions"><button class="button" type="button" data-cancel>Cancel</button><button class="button button-primary" type="submit">Save automation</button></div><p class="form-message" data-form-message></p></form>`;
    const form=root.querySelector("form"), type=form.elements.trigger_type;
    type.value=t.type||"state";
    const updateTriggerVisibility=()=>{const schedule=type.value==="schedule"; ["trigger-device-field","trigger-cap-field","trigger-op-field","trigger-value-field"].forEach(cn=>root.querySelector(`.${cn}`)?.classList.toggle("is-hidden",schedule)); root.querySelector(".trigger-time-field")?.classList.toggle("is-hidden",!schedule);};
    const updateCaps=(deviceField,capField)=>{const s=form.elements[capField];s.innerHTML=capOptions(form.elements[deviceField].value,s.value);};
    form.elements.trigger_device.addEventListener("change",()=>{form.elements.trigger_capability.innerHTML=capOptions(form.elements.trigger_device.value);});
    form.elements.trigger_type.addEventListener("change",updateTriggerVisibility);
    if(t.hardware_id_hex){form.elements.trigger_capability.innerHTML=capOptions(t.hardware_id_hex,t.capability);}
    updateTriggerVisibility();
    const renumber=()=>{root.querySelectorAll("[data-action-row]").forEach((r,i)=>r.querySelector(".automation-row-number").textContent=i+1); root.querySelectorAll("[data-condition-row]").forEach((r,i)=>r.querySelector(".automation-row-number").textContent=i+1); root.querySelector("[data-condition-empty]")?.classList.toggle("is-hidden",!!root.querySelector("[data-condition-row]"));};
    const bindRows=()=>{root.querySelectorAll("[data-action-row] select[data-field=device]").forEach(s=>s.onchange=()=>{const cap=s.closest("[data-action-row]").querySelector('[data-field="capability"]');cap.innerHTML=capOptions(s.value);}); root.querySelectorAll("[data-condition-row] select[data-field=device]").forEach(s=>s.onchange=()=>{const cap=s.closest("[data-condition-row]").querySelector('[data-field="capability"]');cap.innerHTML=capOptions(s.value);}); root.querySelectorAll("[data-remove-action]").forEach(b=>b.onclick=()=>{b.closest("[data-action-row]").remove();renumber();}); root.querySelectorAll("[data-remove-condition]").forEach(b=>b.onclick=()=>{b.closest("[data-condition-row]").remove();renumber();});};
    root.querySelector("[data-add-action]").onclick=()=>{const box=root.querySelector("[data-actions]");box.insertAdjacentHTML("beforeend",actionRow({},box.children.length));bindRows();};
    root.querySelector("[data-add-condition]").onclick=()=>{const box=root.querySelector("[data-conditions]");box.insertAdjacentHTML("beforeend",conditionRow({},box.children.length));bindRows();renumber();};
    form.querySelector("[data-cancel]").onclick=()=>refreshAutomations(root); bindRows();renumber();
    form.addEventListener("submit",async e=>{e.preventDefault();const msg=form.querySelector("[data-form-message]");const triggerType=type.value;let trigger;if(triggerType==="schedule") trigger={type:"schedule",time:form.elements.trigger_time.value}; else {const cap=form.elements.trigger_capability.value;trigger={type:triggerType,hardware_id_hex:form.elements.trigger_device.value,capability:cap,operator:form.elements.trigger_operator.value,value:valueFrom(form.elements.trigger_value.value,cap)};}
        const actions=[...root.querySelectorAll("[data-action-row]")].map(r=>{const d=r.querySelector('[data-field="device"]').value,cap=r.querySelector('[data-field="capability"]').value;return{hardware_id_hex:d,command:"set_capability",data:{name:cap,value:valueFrom(r.querySelector('[data-field="value"]').value,cap)}};});
        const conditions=[...root.querySelectorAll("[data-condition-row]")].filter(r=>r.querySelector('[data-field="device"]').value&&r.querySelector('[data-field="capability"]').value).map(r=>{const d=r.querySelector('[data-field="device"]').value,cap=r.querySelector('[data-field="capability"]').value;return{type:"reading",hardware_id_hex:d,capability:cap,operator:r.querySelector('[data-field="operator"]').value,value:valueFrom(r.querySelector('[data-field="value"]').value,cap)};});
        if(!actions.length){msg.textContent="Add at least one action.";return;} if(triggerType==="schedule"&&!form.elements.trigger_time.value){msg.textContent="Choose a schedule time.";return;} try{const payload={name:form.elements.name.value.trim(),enabled:automation?automation.enabled:true,config:{trigger,conditions,actions}};if(automation)await updateAutomation(automation.id,payload);else await createAutomation(payload);await refreshAutomations(root);}catch(err){msg.textContent=err.message;}
    });
}

export async function refreshAutomations(root){if(!root||loading)return;loading=true;try{const data=await getAutomations();render(root,Array.isArray(data)?data:[]);}catch(e){root.innerHTML=`<section class="card"><div class="empty-state"><span class="empty-state-icon">${UI_ICONS.alert}</span><div><strong>Automations unavailable</strong><p>${esc(e.message)}</p></div></div></section>`;}finally{loading=false;}}
export function initAutomationsPage(){if(initialized)return;initialized=true;}
