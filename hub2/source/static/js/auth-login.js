import { renderIcons } from './icon.js';
import { hasAdminAccount, isAuthenticated } from './components/auth.js';
import { login } from './api.js';

const form = document.querySelector('#login-form');
const message = document.querySelector('#login-message');
const submit = document.querySelector('#login-submit');

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
        const email = String(data.get('email') || '').trim();
        const password = String(data.get('password') || '');

        if (!email || !password) {
            showMessage('Enter your email address and password.');
            return;
        }

        submit.disabled = true;

        try {
            const result = await login({ email, password });

            if (!result.ok) {
                showMessage(result.error);
                return;
            }

            showMessage('Signed in successfully. Opening your dashboard…', 'success');
            window.setTimeout(() => window.location.replace('index.html#home'), 250);
        } catch (error) {
            showMessage(error.message || 'Unable to sign in right now.');
        } finally {
            submit.disabled = false;
        }
    });

    document.querySelector('#forgot-password').addEventListener('click', () => {
        showMessage('Password recovery will be connected to the account service in a future API version.');
    });

    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
        button.addEventListener('click', () => {
            const input = document.querySelector(`#${button.dataset.passwordToggle}`);
            input.type = input.type === 'password' ? 'text' : 'password';
            button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
        });
    });

});

// if (!hasAdminAccount()) {
//     const setupLink = document.querySelector('.auth-secondary');
//     setupLink.textContent = 'First-time administrator setup';
// }
