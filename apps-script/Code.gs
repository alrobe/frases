const APP_TIME_ZONE = 'America/La_Paz';

const REQUIRED_PROPERTIES = [
  'SPREADSHEET_ID',
  'LETTER_PASSWORD'
];

const SESSION_TTL_SECONDS = 30 * 60;
const MESSAGE_CACHE_TTL_SECONDS = 5 * 60;

function doPost(event) {
  try {
    const properties = getRequiredProperties();
    const parameters = event?.parameter || {};

    const sessionToken = parameters.sessionToken;

    // Sesión existente
    if (isValidSessionToken(sessionToken)) {
      return jsonResponse({
        ok: true,
        message: getMessage(
          properties,
          parameters.previousMessage
        )
      });
    }

    // Nueva sesión
    const password = parameters.password;

    if (
      typeof password !== 'string' ||
      password !== properties.LETTER_PASSWORD
    ) {
      return jsonResponse({
        ok: false
      });
    }

    const newToken = createSessionToken();

    return jsonResponse({
      ok: true,
      message: getMessage(
        properties,
        parameters.previousMessage
      ),
      sessionToken: newToken
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      ok: false,
      error: 'SERVICE_UNAVAILABLE'
    });
  }
}

function doGet() {
  return jsonResponse({
    ok: false,
    error: 'METHOD_NOT_ALLOWED'
  });
}

function getRequiredProperties() {
  const properties =
    PropertiesService
      .getScriptProperties()
      .getProperties();

  const required = [
    'SPREADSHEET_ID',
    'LETTER_PASSWORD'
  ];

  const missing = required.filter(
    key => !properties[key]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing script properties: ${missing.join(', ')}`
    );
  }

  return properties;
}

function createSessionToken() {
  const token = Utilities.getUuid();

  CacheService
    .getScriptCache()
    .put(
      `session:${token}`,
      '1',
      SESSION_TTL_SECONDS
    );

  return token;
}

function isValidSessionToken(token) {
  if (
    typeof token !== 'string' ||
    token.length === 0
  ) {
    return false;
  }

  return (
    CacheService
      .getScriptCache()
      .get(`session:${token}`) === '1'
  );
}

function getMessage(properties, previousMessage) {
  const cache = CacheService.getScriptCache();

  const cacheKey = 'letter-messages-v1';

  let cached = cache.get(cacheKey);

  if (cached) {
    cached = JSON.parse(cached);
  } else {
    cached = loadMessages(properties);

    cache.put(
      cacheKey,
      JSON.stringify(cached),
      MESSAGE_CACHE_TTL_SECONDS
    );
  }

  // Mensaje especial del día
  if (cached.todayMessage) {
    return cached.todayMessage;
  }

  const messages = cached.randomMessages;

  if (!messages.length) {
    throw new Error(
      'The sheet does not contain any valid messages.'
    );
  }

  // Evitar repetir el mensaje anterior
  const alternatives = previousMessage
    ? messages.filter(
        message => message !== previousMessage
      )
    : messages;

  const pool =
    alternatives.length
      ? alternatives
      : messages;

  return pool[
    Math.floor(Math.random() * pool.length)
  ];
}

function loadMessages(properties) {
  const spreadsheet = SpreadsheetApp.openById(
    properties.SPREADSHEET_ID
  );

  const sheetName =
    properties.SHEET_NAME || 'Sheet1';

  const sheet =
    spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      `Sheet not found: ${sheetName}`
    );
  }

  const lastRow = sheet.getLastRow();

  if (lastRow === 0) {
    return {
      todayMessage: null,
      randomMessages: []
    };
  }

  // Solo A:C
  const rows = sheet
    .getRange(1, 1, lastRow, 3)
    .getValues();

  const today = Utilities.formatDate(
    new Date(),
    APP_TIME_ZONE,
    'yyyy-MM-dd'
  );

  let todayMessage = null;
  const randomMessages = [];

  for (const row of rows) {
    const date = formatSheetDate(row[0]);
    const specialMessage = row[1];
    const randomMessage = row[2];

    if (
      date === today &&
      isNonEmptyString(specialMessage)
    ) {
      todayMessage = specialMessage.trim();
    }

    if (isNonEmptyString(randomMessage)) {
      randomMessages.push(
        randomMessage.trim()
      );
    }
  }

  return {
    todayMessage,
    randomMessages
  };
}

function formatSheetDate(value) {
  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return Utilities.formatDate(
      value,
      APP_TIME_ZONE,
      'yyyy-MM-dd'
    );
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = value
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;

  if (!isValidDate(year, month, day)) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function isValidDate(year, month, day) {
  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function isNonEmptyString(value) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  );
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(
      JSON.stringify(payload)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}