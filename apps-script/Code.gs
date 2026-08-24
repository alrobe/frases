const APP_TIME_ZONE = 'America/La_Paz';
const REQUIRED_PROPERTIES = ['SPREADSHEET_ID', 'LETTER_PASSWORD'];
const SESSION_TTL_SECONDS = 30 * 60;

/**
 * Receives a password and returns the applicable message without exposing the
 * spreadsheet or password to the browser.
 */
function doPost(event) {
  try {
    const properties = getRequiredProperties();
    const parameters = event && event.parameter ? event.parameter : {};
    const sessionToken = parameters.sessionToken;

    if (isValidSessionToken(sessionToken)) {
      return jsonResponse({
        ok: true,
        message: getMessage(
          properties,
          parameters.refresh === 'true',
          parameters.previousMessage
        )
      });
    }

    const password = parameters.password;
    if (typeof password !== 'string' || password !== properties.LETTER_PASSWORD) {
      return jsonResponse({ ok: false });
    }

    return jsonResponse({
      ok: true,
      message: getMessage(
        properties,
        parameters.refresh === 'true',
        parameters.previousMessage
      ),
      sessionToken: createSessionToken()
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: 'SERVICE_UNAVAILABLE' });
  }
}

function doGet() {
  return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' });
}

function getRequiredProperties() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const missing = REQUIRED_PROPERTIES.filter((key) => !properties[key]);

  if (missing.length > 0) {
    throw new Error(`Missing script properties: ${missing.join(', ')}`);
  }

  return properties;
}

function createSessionToken() {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put(`session:${token}`, '1', SESSION_TTL_SECONDS);
  return token;
}

function isValidSessionToken(token) {
  return typeof token === 'string'
    && token.length > 0
    && CacheService.getScriptCache().get(`session:${token}`) === '1';
}

function getMessage(properties, refresh, previousMessage) {
  const spreadsheet = SpreadsheetApp.openById(properties.SPREADSHEET_ID);
  const sheetName = properties.SHEET_NAME || 'Sheet1';
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const rows = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), APP_TIME_ZONE, 'yyyy-MM-dd');
  const randomMessages = [];
  let todayMessage = null;

  rows.forEach((row) => {
    const date = formatSheetDate(row[0]);
    const specialMessage = row[1];
    const randomMessage = row[2];

    if (date === today && isNonEmptyString(specialMessage)) {
      todayMessage = specialMessage;
    }

    if (isNonEmptyString(randomMessage)) {
      randomMessages.push(randomMessage);
    }
  });

  if (todayMessage) return todayMessage;
  if (randomMessages.length === 0) {
    if (todayMessage) return todayMessage;
    throw new Error('The sheet does not contain any valid messages.');
  }

  const alternatives = randomMessages.filter((message) => message !== previousMessage);
  const messages = alternatives.length > 0 ? alternatives : randomMessages;
  return messages[Math.floor(Math.random() * messages.length)];
}

function formatSheetDate(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return null;
    return Utilities.formatDate(value, APP_TIME_ZONE, 'yyyy-MM-dd');
  }

  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  if (!isValidDate(year, month, day)) return null;

  return `${year}-${month}-${day}`;
}

function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
