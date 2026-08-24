/**
 * Interactive Letter client
 * Messages and password validation are handled by Apps Script.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyIfngBUYhGFXETeIuG_g1FVmys2cTmFvvppvnkIUGn0ugj1Mo5fIB_GTBcKasH5nb0/exec';

const elements = {
    flap: document.getElementById('flap'),
    letter: document.getElementById('letter'),
    openBtn: document.getElementById('openBtn'),
    resetBtn: document.getElementById('resetBtn'),
    floatingHearts: document.getElementById('floatingHearts'),
    letterText: document.getElementById('letterText'),
    passwordDialog: document.getElementById('passwordDialog'),
    passwordInput: document.getElementById('passwordInput')
};

let isOpen = false;
let isRequestPending = false;

function renderMessage(message) {
    const paragraph = document.createElement('p');
    paragraph.className = 'message';
    paragraph.textContent = message;
    elements.letterText.replaceChildren(paragraph);
}

function isConfigured() {
    return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(APPS_SCRIPT_URL);
}

function requestPassword() {
    return new Promise(resolve => {
        elements.passwordInput.value = '';
        elements.passwordDialog.addEventListener('close', () => {
            const password = elements.passwordDialog.returnValue === 'confirm'
                ? elements.passwordInput.value
                : null;
            elements.passwordInput.value = '';
            resolve(password);
        }, { once: true });
        elements.passwordDialog.showModal();
        elements.passwordInput.focus();
    });
}

async function requestMessage(password) {
    const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams({ password })
    });

    if (!response.ok) {
        throw new Error(`The message service returned ${response.status}.`);
    }

    const payload = await response.json();
    if (typeof payload?.ok !== 'boolean') {
        throw new Error('The message service returned an invalid response.');
    }

    return payload;
}

function createFloatingHearts() {
    elements.floatingHearts.innerHTML = '';

    for (let i = 0; i < 50; i++) {
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.textContent = '✨';
        heart.style.left = `${30 + Math.random() * 40}%`;
        heart.style.top = `${40 + Math.random() * 20}%`;
        heart.style.fontSize = `${20 + Math.random() * 15}px`;
        heart.style.animationDelay = `${i * 0.05}s`;

        elements.floatingHearts.appendChild(heart);
        setTimeout(() => heart.remove(), 4000);
    }
}

async function openEnvelope() {
    if (isOpen || isRequestPending || !isConfigured()) return;

    const password = await requestPassword();
    if (password === null) return;

    isRequestPending = true;
    elements.openBtn.disabled = true;
    elements.openBtn.classList.add('is-loading');
    elements.openBtn.setAttribute('aria-busy', 'true');
    elements.resetBtn.disabled = true;
    renderMessage('Verifying password...');

    try {
        const result = await requestMessage(password);

        if (!result.ok) {
            renderMessage('Enter the password to open this message.');
            alert('Solo Paty puede abrir este mensaje!!! 😠');
            return;
        }

        if (typeof result.message !== 'string' || !result.message.trim()) {
            throw new Error('The message service did not return a message.');
        }

        renderMessage(result.message);
        isOpen = true;
        elements.flap.classList.add('open');

        setTimeout(createFloatingHearts, 200);
        setTimeout(() => elements.letter.classList.add('revealed'), 300);

        elements.resetBtn.disabled = false;
    } catch (error) {
        console.error(error);
        renderMessage('Unable to verify the password. Please try again later.');
        alert('No se pudo abrir el mensaje. Inténtalo de nuevo más tarde.');
    } finally {
        isRequestPending = false;
        elements.openBtn.classList.remove('is-loading');
        elements.openBtn.removeAttribute('aria-busy');
        elements.openBtn.disabled = isOpen;
        elements.resetBtn.disabled = !isOpen;
    }
}

function resetEnvelope() {
    isOpen = false;
    elements.letter.classList.remove('revealed');
    elements.flap.classList.remove('open');
    elements.floatingHearts.innerHTML = '';

    elements.openBtn.disabled = false;
    elements.resetBtn.disabled = true;
    renderMessage('Enter the password to open this message.');
}

elements.openBtn.addEventListener('click', openEnvelope);
elements.resetBtn.addEventListener('click', resetEnvelope);
elements.resetBtn.disabled = true;

if (isConfigured()) {
    elements.openBtn.disabled = false;
    renderMessage('Enter the password to open this message.');
} else {
    elements.openBtn.disabled = true;
    renderMessage('This app has not been configured yet.');
}
