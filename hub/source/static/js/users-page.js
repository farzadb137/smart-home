import { getUsers, createUser, updateUser, deleteUser } from "./api.js";

let editingUserId = null;

function usersView() {
    return document.querySelector('[data-view="settings"]');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderUsers(users) {
    const view = usersView();
    if (!view) return;

    view.innerHTML = `
        <div class="card">
            <div class="users-toolbar">
                <div>
                    <p class="card-label">SYSTEM</p>
                    <h2>Users</h2>
                </div>
                <button class="detail-btn" id="add-user-btn">+ Add User</button>
            </div>
            <div class="users-table-wrap">
                <table class="users-table">
                    <thead>
                        <tr><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${escapeHtml(user.username)}</td>
                                <td>${escapeHtml(user.role)}</td>
                                <td class="user-status ${user.enabled ? "" : "disabled"}">${user.enabled ? "Active" : "Disabled"}</td>
                                <td>
                                    <button class="detail-btn user-edit-btn" data-id="${user.id}">Edit</button>
                                    <button class="detail-btn user-delete-btn" data-id="${user.id}">Delete</button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
            <div id="user-message" class="user-message"></div>
        </div>
    `;

    document.getElementById("add-user-btn").addEventListener("click", () => renderUserForm());
    document.querySelectorAll(".user-edit-btn").forEach(button => {
        button.addEventListener("click", () => {
            const user = users.find(item => item.id === Number(button.dataset.id));
            renderUserForm(user);
        });
    });
    document.querySelectorAll(".user-delete-btn").forEach(button => {
        button.addEventListener("click", async () => {
            if (!confirm("Delete this user?")) return;
            try {
                await deleteUser(Number(button.dataset.id));
                await loadUsers({ force: true });
            } catch (error) {
                showMessage(error.message);
            }
        });
    });
}

function renderUserForm(user = null) {
    editingUserId = user?.id ?? null;
    const view = usersView();
    view.innerHTML = `
        <div class="card">
            <p class="card-label">SYSTEM</p>
            <h2>${user ? "Edit User" : "Add User"}</h2>
            <form class="user-form" id="user-form">
                <label for="user-username">Username</label>
                <input id="user-username" maxlength="64" value="${escapeHtml(user?.username ?? "")}" required>

                <label for="user-password">${user ? "New password (leave blank to keep current)" : "Password"}</label>
                <input id="user-password" type="password" minlength="8" autocomplete="new-password" ${user ? "" : "required"}>

                <label for="user-role">Role</label>
                <select id="user-role">
                    <option value="user" ${user?.role === "user" ? "selected" : ""}>User</option>
                    <option value="administrator" ${user?.role === "administrator" ? "selected" : ""}>Administrator</option>
                </select>

                ${user ? `
                    <label for="user-enabled">Status</label>
                    <select id="user-enabled">
                        <option value="true" ${user.enabled ? "selected" : ""}>Active</option>
                        <option value="false" ${!user.enabled ? "selected" : ""}>Disabled</option>
                    </select>
                ` : ""}

                <div class="user-form-actions">
                    <button class="detail-btn" type="submit">${user ? "Save Changes" : "Create User"}</button>
                    <button class="detail-btn" type="button" id="cancel-user-btn">Cancel</button>
                </div>
                <div id="user-form-message" class="user-message"></div>
            </form>
        </div>
    `;

    document.getElementById("cancel-user-btn").addEventListener("click", () => loadUsers({ force: true }));
    document.getElementById("user-form").addEventListener("submit", async event => {
        event.preventDefault();
        const message = document.getElementById("user-form-message");
        message.textContent = "";
        const payload = {
            username: document.getElementById("user-username").value.trim(),
            password: document.getElementById("user-password").value,
            role: document.getElementById("user-role").value,
        };
        if (user) {
            payload.enabled = document.getElementById("user-enabled").value === "true";
        }

        try {
            if (editingUserId === null) {
                await createUser(payload);
            } else {
                if (!payload.password) delete payload.password;
                await updateUser(editingUserId, payload);
            }
            await loadUsers({ force: true });
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

function showMessage(message) {
    const element = document.getElementById("user-message");
    if (element) element.textContent = message;
}

async function loadUsers({ force = false } = {}) {
    if (!force && document.getElementById("user-form")) {
        return;
    }

    try {
        const users = await getUsers();

        // A request may have started before the user opened Add/Edit.
        // Never replace an active form with the user list unless this
        // load was explicitly requested with force=true.
        if (!force && document.getElementById("user-form")) {
            return;
        }

        renderUsers(users);
    } catch (error) {
        showMessage(error.message);
    }
}

export function initUsersPage() {
    const loadForSettingsRoute = () => {
        if (window.location.hash.replace(/^#\/?/, "").split("/")[0] === "settings") {
            loadUsers();
        }
    };

    window.addEventListener("hashchange", loadForSettingsRoute);
    loadForSettingsRoute();
}
