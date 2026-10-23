// User/access domain module.
import { appstate } from "../state.js";
import { createIcon } from "../icon.js";
import { renderEmptyState } from "./empty-state.js";
import { createUser, deleteUser, updateUser } from "../api.js";
import { initials } from "../util/dom.js";

export function renderUsers() {
  try {
    return `
        <section class="settings-card" id="settings-users">
            <div class="settings-card-header">
                <div class="settings-card-heading">
                    <span class="settings-card-icon">${createIcon("user")}</span>
                    <div><h3>Users & access</h3><p>Invite household members, control roles, and manage access.</p></div>
                </div>
                <button class="settings-button" data-add-user>${createIcon("plus")} Add user</button>
            </div>
            <div class="settings-table-wrap">
                <table class="settings-table">
                    <thead><tr><th>User</th><th>Role</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                        ${
                        appstate.users.length
                            ? appstate.users.map((u) => `
                            <tr>
                                <td>
                                    <div class="settings-user">
                                        <span class="settings-user-avatar">${initials(u.username)}</span>
                                        <div class="settings-user-copy"><strong>${u.username}</strong><span>--</span></div>
                                    </div>
                                </td>
                                <td>${u.role}</td>
                                <td><span class="settings-status${u.enabled ? "" : " is-disabled"}">${u.enabled ? "Active" : "Disabled"}</span></td>
                                <td>
                                    <div class="settings-actions">
                                        <button class="settings-icon-button" data-user-edit="${u.id}">${createIcon("edit")}</button>
                                        <button class="settings-icon-button" data-user-toggle="${u.id}">${createIcon("power")}</button>
                                        <button class="settings-icon-button danger" data-user-delete="${u.id}">${createIcon("trash")}</button>
                                    </div>
                                </td>
                            </tr>`,
                                ).join("")
                            : `<tr><td colspan="4">${renderEmptyState({ icon: "user", title: "No users yet", message: "Add household members when you are ready to share access." })}</td></tr>`
                        }
                    </tbody>
                </table>
            </div>
        </section>`;
  } catch (error) {
    console.error(error.message);
  }
}

export function bindUsers(root = document, onChange = () => {}) {
  root.querySelector("[data-add-user]")?.addEventListener("click", () => openUserModal(null, onChange));
  root.querySelectorAll("[data-user-edit]").forEach((b) => b.addEventListener("click", () => openUserModal(appstate.users.find((u) => u.id === Number(b.dataset.userEdit)), onChange)));
  root.querySelectorAll("[data-user-toggle]").forEach((b) =>
    b.addEventListener("click", async () => {
      const u = appstate.users.find((x) => x.id === Number(b.dataset.userToggle));
      if (u) {
        await updateUser(u.id, {enabled: !u.enabled});
        onChange();
      }
    }),
  );
  root.querySelectorAll("[data-user-delete]").forEach((b) =>
    b.addEventListener("click", async () => {
      const u = appstate.users.find((x) => x.id === Number(b.dataset.userDelete));
      if (!u || u.role === "administrator")
        return alert("The Owner account cannot be deleted.");
      if (confirm(`Delete ${u.username}?`)) {
        await deleteUser(u.id);
        onChange();
      }
    }),
  );
}

function openUserModal(user, onChange) {
  const editing = !!user;
  const back = document.createElement("div");
  back.className = "settings-modal-backdrop";
  back.innerHTML = `
    <div class="settings-modal">
      <div class="settings-modal-header">
        <div><h3>${editing ? "Edit user" : "Add user"}</h3><p>${editing ? "Update account details and access role." : "Create a new household account."}</p></div>
        <button type="button" class="settings-modal-close" data-close>${createIcon("plus")}</button>
      </div>
      <form class="settings-form">
        <div class="settings-field"><label>Name</label><input name="name" required value="${user?.name || ""}"></div>
        <div class="settings-field"><label>Email</label><input name="email" type="email" value="${user?.email || ""}"></div>
        <div class="settings-field"><label>Password</label><input name="password" minlength="8" ${user ? "" : "required"}></div>
        <div class="settings-field"><label>Role</label><select name="role">${["administrator", "user"].map((r) => `<option ${user?.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        <div class="settings-form-actions"><button type="button" class="settings-button-secondary" data-close>Cancel</button><button class="settings-button">${editing ? "Save changes" : "Create user"}</button></div>
      </form>
    </div>`;
  document.body.appendChild(back);
  const close = () => back.remove();
  back.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
  back.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get("name").trim();
    const password = fd.get("password");
    const role = fd.get("role");
    if (editing)
      await updateUser(user.id, {username: name, password: password, role: role});
    else
      await createUser({username: name, password: password, role: role});
    close();
    onChange();
  });
}