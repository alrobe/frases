const APP_TIME_ZONE = 'America/La_Paz';

const REQUIRED_PROPERTIES = [
  'SPREADSHEET_ID',
  'LETTER_PASSWORD'
];

const SESSION_TTL_SECONDS = 30 * 60;

// ============================================================
// MESSAGE STORAGE
// ============================================================

// Cache rápida.
// Puede desaparecer antes del TTL y no pasa nada,
// porque PropertiesService contiene una copia persistente.
const MESSAGE_CACHE_KEY = 'letter-messages-v3';

// Almacenamiento persistente.
const MESSAGE_STORAGE_KEY = 'letter-messages-v3';

// Tiempo de vida de la cache rápida.
// NO determina cuándo se actualizan los mensajes.
// Los mensajes se actualizan mediante onEdit().
const MESSAGE_CACHE_TTL_SECONDS = 21600; // 6 horas


// ============================================================
// WEB APP
// ============================================================

/**
 * Recibe la contraseña o un sessionToken
 * y devuelve el mensaje correspondiente.
 */
function doPost(event) {
  try {
    const properties = getRequiredProperties();

    const parameters =
      event && event.parameter
        ? event.parameter
        : {};

    const sessionToken =
      parameters.sessionToken;

    // ----------------------------------------------------------
    // SESIÓN EXISTENTE
    // ----------------------------------------------------------

    if (isValidSessionToken(sessionToken)) {
      return jsonResponse({
        ok: true,
        message: getMessage(
          properties,
          parameters.previousMessage
        )
      });
    }

    // ----------------------------------------------------------
    // NUEVA AUTENTICACIÓN
    // ----------------------------------------------------------

    const password =
      parameters.password;

    if (
      typeof password !== 'string' ||
      password !== properties.LETTER_PASSWORD
    ) {
      return jsonResponse({
        ok: false
      });
    }

    const newSessionToken =
      createSessionToken();

    return jsonResponse({
      ok: true,

      message: getMessage(
        properties,
        parameters.previousMessage
      ),

      sessionToken: newSessionToken
    });

  } catch (error) {
    console.error(error);

    return jsonResponse({
      ok: false,
      error: 'SERVICE_UNAVAILABLE'
    });
  }
}


/**
 * GET no está permitido.
 */
function doGet() {
  return jsonResponse({
    ok: false,
    error: 'METHOD_NOT_ALLOWED'
  });
}


// ============================================================
// SCRIPT PROPERTIES
// ============================================================

function getRequiredProperties() {
  const properties =
    PropertiesService
      .getScriptProperties()
      .getProperties();

  const missing =
    REQUIRED_PROPERTIES.filter(
      key => !properties[key]
    );

  if (missing.length > 0) {
    throw new Error(
      `Missing script properties: ${missing.join(', ')}`
    );
  }

  return properties;
}


// ============================================================
// SESSION
// ============================================================

function createSessionToken() {
  const token =
    Utilities.getUuid();

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


// ============================================================
// GET MESSAGE
// ============================================================

/**
 * Obtiene un mensaje.
 *
 * Orden de prioridad:
 *
 * 1. CacheService
 * 2. PropertiesService
 * 3. Google Sheets
 *
 * Normalmente solamente se ejecutará el punto 1.
 */
function getMessage(
  properties,
  previousMessage
) {
  const cache =
    CacheService.getScriptCache();

  // ==========================================================
  // 1. CACHE SERVICE
  // ==========================================================

  let stored =
    cache.get(
      MESSAGE_CACHE_KEY
    );

  if (stored) {
    const data =
      parseStoredMessages(stored);

    if (data) {
      console.log(
        'MESSAGE SOURCE: CacheService'
      );

      return selectMessage(
        data,
        previousMessage
      );
    }
  }

  // ==========================================================
  // 2. PROPERTIES SERVICE
  // ==========================================================

  const scriptProperties =
    PropertiesService
      .getScriptProperties();

  stored =
    scriptProperties.getProperty(
      MESSAGE_STORAGE_KEY
    );

  if (stored) {
    const data =
      parseStoredMessages(stored);

    if (data) {
      console.log(
        'MESSAGE SOURCE: PropertiesService'
      );

      // Reconstruir cache rápida.
      cache.put(
        MESSAGE_CACHE_KEY,
        JSON.stringify(data),
        MESSAGE_CACHE_TTL_SECONDS
      );

      return selectMessage(
        data,
        previousMessage
      );
    }
  }

  // ==========================================================
  // 3. GOOGLE SHEETS
  // ==========================================================

  console.log(
    'MESSAGE SOURCE: Google Sheets'
  );

  const data =
    loadMessages(properties);

  const json =
    JSON.stringify(data);

  // Guardar almacenamiento persistente.
  scriptProperties.setProperty(
    MESSAGE_STORAGE_KEY,
    json
  );

  // Guardar cache rápida.
  cache.put(
    MESSAGE_CACHE_KEY,
    json,
    MESSAGE_CACHE_TTL_SECONDS
  );

  return selectMessage(
    data,
    previousMessage
  );
}


// ============================================================
// SELECT MESSAGE
// ============================================================

/**
 * Selecciona:
 *
 * 1. Mensaje especial de hoy.
 * 2. Si no existe, mensaje aleatorio.
 *
 * Evita repetir inmediatamente el mensaje anterior.
 */
function selectMessage(
  data,
  previousMessage
) {
  const today =
    Utilities.formatDate(
      new Date(),
      APP_TIME_ZONE,
      'yyyy-MM-dd'
    );

  // ----------------------------------------------------------
  // MENSAJE ESPECIAL DE HOY
  // ----------------------------------------------------------

  const todayMessage =
    data.specialMessages &&
    data.specialMessages[today];

  if (todayMessage) {
    return todayMessage;
  }

  // ----------------------------------------------------------
  // MENSAJES ALEATORIOS
  // ----------------------------------------------------------

  const messages =
    Array.isArray(data.randomMessages)
      ? data.randomMessages
      : [];

  if (messages.length === 0) {
    throw new Error(
      'The sheet does not contain any valid messages.'
    );
  }

  // ----------------------------------------------------------
  // Evitar repetir inmediatamente el anterior.
  // ----------------------------------------------------------

  const alternatives =
    typeof previousMessage === 'string' &&
    previousMessage.length > 0
      ? messages.filter(
          message =>
            message !== previousMessage
        )
      : messages;

  const pool =
    alternatives.length > 0
      ? alternatives
      : messages;

  return pool[
    Math.floor(
      Math.random() * pool.length
    )
  ];
}


// ============================================================
// PARSE STORAGE
// ============================================================

function parseStoredMessages(value) {
  try {
    const data =
      JSON.parse(value);

    if (
      !data ||
      !Array.isArray(
        data.randomMessages
      ) ||
      !data.specialMessages
    ) {
      return null;
    }

    return data;

  } catch (error) {
    console.error(
      'Could not parse stored messages.'
    );

    return null;
  }
}


// ============================================================
// LOAD GOOGLE SHEETS
// ============================================================

/**
 * Lee Google Sheets y procesa los mensajes.
 *
 * Esta función normalmente será ejecutada por onEdit().
 */
function loadMessages(properties) {
  console.log(
    'Reading Google Sheets...'
  );

  const spreadsheet =
    SpreadsheetApp.openById(
      properties.SPREADSHEET_ID
    );

  const sheetName =
    properties.SHEET_NAME ||
    'Sheet1';

  const sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    throw new Error(
      `Sheet not found: ${sheetName}`
    );
  }

  const lastRow =
    sheet.getLastRow();

  // ----------------------------------------------------------
  // HOJA VACÍA
  // ----------------------------------------------------------

  if (lastRow === 0) {
    return {
      randomMessages: [],
      specialMessages: {}
    };
  }

  // ----------------------------------------------------------
  // LEER SOLAMENTE A:C
  // ----------------------------------------------------------

  const rows =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        3
      )
      .getValues();

  const randomMessages = [];
  const specialMessages = {};

  // ----------------------------------------------------------
  // PROCESAR FILAS
  // ----------------------------------------------------------

  for (const row of rows) {
    const date =
      formatSheetDate(
        row[0]
      );

    const specialMessage =
      row[1];

    const randomMessage =
      row[2];

    // --------------------------------------------------------
    // MENSAJE ESPECIAL
    // --------------------------------------------------------

    if (
      date &&
      isNonEmptyString(
        specialMessage
      )
    ) {
      specialMessages[date] =
        specialMessage.trim();
    }

    // --------------------------------------------------------
    // MENSAJE ALEATORIO
    // --------------------------------------------------------

    if (
      isNonEmptyString(
        randomMessage
      )
    ) {
      randomMessages.push(
        randomMessage.trim()
      );
    }
  }

  console.log(
    `Loaded ${randomMessages.length} random messages.`
  );

  console.log(
    `Loaded ${Object.keys(specialMessages).length} special dates.`
  );

  return {
    randomMessages,
    specialMessages
  };
}


// ============================================================
// ON EDIT
// ============================================================

/**
 * Actualiza el almacenamiento cuando se modifica
 * la hoja de mensajes.
 *
 * Flujo:
 *
 * Google Sheets
 *      ↓
 *    onEdit
 *      ↓
 * loadMessages()
 *      ↓
 * PropertiesService
 *      ↓
 * CacheService
 */
function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  const sheet =
    e.range.getSheet();

  const scriptProperties =
    PropertiesService
      .getScriptProperties();

  const sheetName =
    scriptProperties.getProperty(
      'SHEET_NAME'
    ) || 'Sheet1';

  // ----------------------------------------------------------
  // IGNORAR OTRAS PESTAÑAS
  // ----------------------------------------------------------

  if (
    sheet.getName() !== sheetName
  ) {
    console.log(
      `Ignoring edit in sheet: ${sheet.getName()}`
    );

    return;
  }

  // ----------------------------------------------------------
  // COLUMNAS MODIFICADAS
  // ----------------------------------------------------------

  const firstColumn =
    e.range.getColumn();

  const lastColumn =
    firstColumn +
    e.range.getNumColumns() -
    1;

  // Solo nos interesan A, B y C.
  if (
    lastColumn < 1 ||
    firstColumn > 3
  ) {
    console.log(
      'Edit does not affect columns A:C. Ignoring.'
    );

    return;
  }

  try {
    console.log(
      'Sheet edited. Rebuilding message storage...'
    );

    // --------------------------------------------------------
    // OBTENER PROPIEDADES
    // --------------------------------------------------------

    const properties =
      getRequiredProperties();

    // --------------------------------------------------------
    // LEER Y PROCESAR SHEET
    // --------------------------------------------------------

    const data =
      loadMessages(
        properties
      );

    const json =
      JSON.stringify(data);

    // --------------------------------------------------------
    // GUARDAR EN PROPERTIES SERVICE
    // --------------------------------------------------------

    scriptProperties.setProperty(
      MESSAGE_STORAGE_KEY,
      json
    );

    console.log(
      'PropertiesService updated successfully.'
    );

    // --------------------------------------------------------
    // GUARDAR EN CACHE SERVICE
    // --------------------------------------------------------

    CacheService
      .getScriptCache()
      .put(
        MESSAGE_CACHE_KEY,
        json,
        MESSAGE_CACHE_TTL_SECONDS
      );

    console.log(
      'CacheService updated successfully.'
    );

    console.log(
      'Message storage and cache updated successfully.'
    );

  } catch (error) {
    console.error(
      `Failed to update message storage: ${error}`
    );
  }
}


// ============================================================
// CREATE EDIT TRIGGER
// ============================================================

/**
 * EJECUTAR ESTA FUNCIÓN MANUALMENTE UNA SOLA VEZ.
 *
 * Crea el trigger instalable:
 *
 * Google Sheets → Editar → onEdit()
 *
 * También elimina triggers anteriores de onEdit
 * para evitar duplicados.
 */
function createEditTrigger() {
  const properties =
    getRequiredProperties();

  const spreadsheetId =
    properties.SPREADSHEET_ID;

  const spreadsheet =
    SpreadsheetApp.openById(
      spreadsheetId
    );

  console.log(
    `Creating edit trigger for: ${spreadsheet.getName()}`
  );

  // ----------------------------------------------------------
  // ELIMINAR TRIGGERS ONEDIT ANTERIORES
  // ----------------------------------------------------------

  const triggers =
    ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {
    if (
      trigger.getHandlerFunction() ===
      'onEdit'
    ) {
      console.log(
        'Deleting existing onEdit trigger.'
      );

      ScriptApp.deleteTrigger(
        trigger
      );
    }
  }

  // ----------------------------------------------------------
  // CREAR NUEVO TRIGGER
  // ----------------------------------------------------------

  ScriptApp
    .newTrigger('onEdit')
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  console.log(
    'Edit trigger created successfully.'
  );
}


// ============================================================
// DATE
// ============================================================

function formatSheetDate(value) {
  // ----------------------------------------------------------
  // FECHA REAL DE GOOGLE SHEETS
  // ----------------------------------------------------------

  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return null;
    }

    return Utilities.formatDate(
      value,
      APP_TIME_ZONE,
      'yyyy-MM-dd'
    );
  }

  // ----------------------------------------------------------
  // FECHA COMO TEXTO
  //
  // DD/MM/YYYY
  // ----------------------------------------------------------

  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const match =
    value
      .trim()
      .match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
      );

  if (!match) {
    return null;
  }

  const [
    ,
    day,
    month,
    year
  ] = match;

  if (
    !isValidDate(
      year,
      month,
      day
    )
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}


function isValidDate(
  year,
  month,
  day
) {
  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    date.getUTCFullYear() ===
      Number(year) &&
    date.getUTCMonth() ===
      Number(month) - 1 &&
    date.getUTCDate() ===
      Number(day)
  );
}


// ============================================================
// HELPERS
// ============================================================

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