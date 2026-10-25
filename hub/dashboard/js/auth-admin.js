import { renderIcons } from './icon.js';
import { hasAdminAccount, isAuthenticated } from './components/auth.js';
import { createUser } from './api.js';

const form = document.querySelector('#admin-form');
const message = document.querySelector('#admin-message');
const submit = document.querySelector('#admin-submit');

function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = `auth-message is-visible is-${type}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    renderIcons();

    if (await isAuthenticated()) {
        window.location.replace('index.html#home');
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        message.className = 'auth-message';

        const data = new FormData(form);
        const name = String(data.get('name') || '').trim();
        const email = String(data.get('email') || '').trim();
        const password = String(data.get('password') || '');
        const confirmPassword = String(data.get('confirmPassword') || '');

        if (name.length < 2) {
            showMessage('Enter your full name.');
            return;
        }

        if (!email || !email.includes('@')) {
            showMessage('Enter a valid email address.');
            return;
        }

        if (password.length < 8) {
            showMessage('Use a password with at least 8 characters.');
            return;
        }

        if (password !== confirmPassword) {
            showMessage('The passwords do not match.');
            return;
        }

        submit.disabled = true;

        try {
            const result = await createUser({username: name, password: password, role: "administrator"})

            if (!result.ok) {
                showMessage(result.error);
                return;
            }

            showMessage('Administrator created. Opening your dashboard…', 'success');
            window.setTimeout(() => window.location.replace('index.html#home'), 400);
        } catch (error) {
            showMessage(error.message || 'Unable to create the administrator account.');
        } finally {
            submit.disabled = false;
        }
    });

    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const input = document.querySelector(`#${button.dataset.passwordToggle}`);
            input.type = input.type === 'password' ? 'text' : 'password';
            button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
        });
    });

});

// if (hasAdminAccount()) {
//     showMessage('An administrator account already exists. Sign in to continue.');
//     submit.disabled = true;
// }






