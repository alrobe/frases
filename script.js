/**
 * Interactive Letter with Google Sheets
 * Dates in DD/MM/YYYY format
 * A new message on every OPEN
 */

// =====================
// GOOGLE SHEETS SETUP
// =====================
google.charts.load('current', { packages: ['corechart'] });

const SHEET_ID = '1t9WezE2NhiJ_AK2cPklX8YOL_xKWlYzm62a2h5frC2U';
const SHEET_NAME = 'Sheet1';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${SHEET_NAME}`;
const APP_TIME_ZONE = 'America/La_Paz';

// =====================
// DOM
// =====================
const elements = {
    flap: document.getElementById('flap'),
    letter: document.getElementById('letter'),
    openBtn: document.getElementById('openBtn'),
    resetBtn: document.getElementById('resetBtn'),
    floatingHearts: document.getElementById('floatingHearts'),
    letterText: document.getElementById('letterText')
};

// =====================
// STATE
// =====================
let isOpen = false;
let PASSWORD = '';
let todayMessage = null;
let randomMessages = [];
let isDataReady = false;

// =====================
// UTILS
// =====================
function todayISO() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(
        parts
            .filter(({ type }) => type !== 'literal')
            .map(({ type, value }) => [type, value])
    );

    return `${values.year}-${values.month}-${values.day}`;
}

function renderMessage(message) {
    const paragraph = document.createElement('p');
    paragraph.className = 'message';
    paragraph.textContent = message;
    elements.letterText.replaceChildren(paragraph);
}

function setOpenButtonState(disabled) {
    elements.openBtn.disabled = disabled;
}

function handleLoadError(message) {
    console.error(message);
    isDataReady = false;
    setOpenButtonState(true);

    const paragraph = document.createElement('p');
    paragraph.className = 'message';
    paragraph.textContent = 'Unable to load the message. Please try again later.';

    const retryButton = document.createElement('button');
    retryButton.className = 'btn btn-secondary';
    retryButton.type = 'button';
    retryButton.textContent = 'RETRY';
    retryButton.addEventListener('click', loadFromSheet);

    elements.letterText.replaceChildren(paragraph, retryButton);
}

function isValidDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === Number(year)
        && date.getUTCMonth() === Number(month) - 1
        && date.getUTCDate() === Number(day);
}

function formatDateFromSheet(value) {
    if (!value) return null;

    // Google Sheets sends an actual Date object
    if (Object.prototype.toString.call(value) === '[object Date]') {
        if (Number.isNaN(value.getTime())) return null;

        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // If it arrives as DD/MM/YYYY text
    if (typeof value === 'string') {
        const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;

        const [, day, month, year] = match;
        if (!isValidDate(year, month, day)) return null;

        return `${year}-${month}-${day}`;
    }

    return null;
}

// =====================
// LOAD DATA FROM SHEET
// =====================
function loadFromSheet() {
    isDataReady = false;
    setOpenButtonState(true);
    renderMessage('Loading message...');

    try {
        const query = new google.visualization.Query(SHEET_URL);

        query.send(response => {
            try {
                if (response.isError()) {
                    handleLoadError(response.getMessage());
                    return;
                }

                const data = response.getDataTable();
                const rows = data.getNumberOfRows();
                const columns = data.getNumberOfColumns();

                // Password from D1
                if (rows === 0 || columns < 4) {
                    handleLoadError('The sheet is empty or does not have the required columns.');
                    return;
                }

                const sheetPassword = data.getValue(0, 3);
                if (typeof sheetPassword !== 'string' || sheetPassword.trim() === '') {
                    handleLoadError('The sheet does not contain a valid password.');
                    return;
                }

                PASSWORD = sheetPassword;
                todayMessage = null;
                randomMessages = [];

                const today = todayISO();

                for (let i = 0; i < rows; i++) {
                    const rawDate = data.getValue(i, 0);
                    const date = formatDateFromSheet(rawDate);
                    const msgB = data.getValue(i, 1);
                    const msgC = data.getValue(i, 2);

                    if (date === today && typeof msgB === 'string' && msgB.trim()) {
                        todayMessage = msgB;
                    }

                    if (typeof msgC === 'string' && msgC.trim()) {
                        randomMessages.push(msgC);
                    }
                }

                if (!todayMessage && randomMessages.length === 0) {
                    handleLoadError('The sheet does not contain any valid messages.');
                    return;
                }

                // Initial message
                chooseMessage();
                isDataReady = true;
                setOpenButtonState(false);
            } catch (error) {
                handleLoadError(error);
            }
        });
    } catch (error) {
        handleLoadError(error);
    }
}

// =====================
// MESSAGE SELECTOR
// =====================
function chooseMessage() {
    const message = todayMessage
        ? todayMessage
        : randomMessages[Math.floor(Math.random() * randomMessages.length)];

    renderMessage(message);
}

// =====================
// FLOATING HEARTS
// =====================
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

// =====================
// ENVELOPE LOGIC
// =====================
function openEnvelope() {
    if (isOpen || !isDataReady) return;

    const input = prompt('Ingresa la contraseña 😉');

    if (input !== PASSWORD) {
        alert('Solo Paty puede abrir este mensaje!!! 😠');
        return;
    }

    // A new message on every OPEN
    chooseMessage();

    isOpen = true;
    elements.flap.classList.add('open');

    setTimeout(createFloatingHearts, 200);
    setTimeout(() => elements.letter.classList.add('revealed'), 300);

    elements.openBtn.disabled = true;
    elements.resetBtn.disabled = false;
}

function resetEnvelope() {
    isOpen = false;
    elements.letter.classList.remove('revealed');
    elements.flap.classList.remove('open');
    elements.floatingHearts.innerHTML = '';

    setOpenButtonState(!isDataReady);
    elements.resetBtn.disabled = true;
}

// =====================
// INIT
// =====================
google.charts.setOnLoadCallback(() => {
    elements.openBtn.addEventListener('click', openEnvelope);
    elements.resetBtn.addEventListener('click', resetEnvelope);
    setOpenButtonState(true);
    elements.resetBtn.disabled = true;
    loadFromSheet();
});
