/**
 * ============================================================================
 * Code.gs — Backend สำหรับเว็บไซต์ “ถึงคุณ ♡” (Google Apps Script Web App)
 * รุ่นไม่ต้องกรอกรหัสเชิญ (Zero-Code Frictionless Mode)
 * ============================================================================
 *
 * คุณสมบัติ:
 * 1. ผู้รับเขียนจดหมายตอบกลับได้ทันทีโดยไม่ต้องล็อกอิน Google และไม่ต้องใส่รหัสผ่านใด ๆ
 * 2. ผูกเข้ากับโฟลเดอร์ Google Drive ปลายทาง 1UAt0ShaC67RVu1_4Ec58evFAUV4nTEGd โดยอัตโนมัติ
 * 3. ป้องกันข้อมูลซ้ำด้วย Idempotency Key, ป้องกันการเขียนชนกันด้วย LockService,
 *    ป้องกันคำขอเก่าทับข้อมูลใหม่ด้วย Version Guard และจำกัดความถี่/ขนาดข้อความเพื่อลดสแปม
 * 4. ไม่อนุญาตให้อ่านรายการจดหมายผ่านลิงก์สาธารณะ (doGet คืนเฉพาะสถานะระบบ)
 */

var CONFIG = {
  MAX_PAYLOAD_BYTES: 35000,
  MAX_TITLE_LENGTH: 120,
  MAX_AUTHOR_LENGTH: 80,
  MAX_BODY_LENGTH: 5000,
  LOCK_WAIT_MS: 10000,
  MAX_SAVES_PER_MINUTE_PER_LETTER: 25,
  MAX_GLOBAL_SAVES_PER_MINUTE: 60,
  TARGET_FOLDER_ID: '1UAt0ShaC67RVu1_4Ec58evFAUV4nTEGd',
  DEFAULT_FOLDER_NAME: 'ถึงคุณ ♡ - จดหมายตอบกลับส่วนตัว',
  DEFAULT_SHEET_NAME: 'ถึงคุณ ♡ - ทะเบียนจดหมายตอบกลับ'
};

/**
 * ป้องกันการเปิดอ่านจดหมายตอบกลับของผู้รับผ่าน GET URL สาธารณะ
 * (อนุญาตให้คืนเฉพาะจดหมายหน้าโต๊ะที่แอดมินตั้งค่าไว้เท่านั้น)
 */
function doGet() {
  var ownerLetters = null;
  var siteCopy = null;
  try {
    var props = PropertiesService.getScriptProperties();
    var rawOwner = props.getProperty('PUBLIC_OWNER_LETTERS_JSON');
    if (rawOwner) {
      ownerLetters = JSON.parse(rawOwner);
    }
    var rawCopy = props.getProperty('PUBLIC_SITE_COPY_JSON');
    if (rawCopy) {
      siteCopy = JSON.parse(rawCopy);
    }
  } catch (e) {
    ownerLetters = null;
  }

  return createJsonResponse({
    ok: true,
    service: 'to-you-private-letter-relay',
    ownerLetters: ownerLetters,
    siteCopy: siteCopy,
    message: 'ระบบพร้อมรับจดหมายผ่าน POST เท่านั้น (ไม่อนุญาตการอ่านจดหมายตอบกลับส่วนตัวผ่านลิงก์สาธารณะ)'
  });
}

/**
 * รับคำขอบันทึกจดหมายผ่าน POST โดยไม่ต้องใช้รหัสเชิญ
 */
function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return createErrorResponse('INVALID_REQUEST', 'รูปแบบคำขอไม่ถูกต้อง');
    }

    var rawContents = e.postData.contents;
    if (rawContents.length > CONFIG.MAX_PAYLOAD_BYTES) {
      return createErrorResponse('PAYLOAD_TOO_LARGE', 'ขนาดข้อความเกินขีดจำกัดที่กำหนด');
    }

    var payload;
    try {
      payload = JSON.parse(rawContents);
    } catch (parseErr) {
      return createErrorResponse('INVALID_JSON', 'ข้อมูลที่ส่งมาไม่ใช่ JSON ที่ถูกต้อง');
    }

    if (!payload || payload.action !== 'saveLetter') {
      return createErrorResponse('UNSUPPORTED_ACTION', 'ไม่รองรับคำสั่งนี้');
    }

    // 1. ตรวจสอบรูปแบบและขนาดข้อมูลจดหมายทุกฟิลด์
    var letterId = typeof payload.letterId === 'string' ? payload.letterId.trim() : '';
    if (!/^ltr_[a-zA-Z0-9_-]{8,64}$/.test(letterId)) {
      return createErrorResponse('INVALID_LETTER_ID', 'รหัสจดหมายไม่ถูกต้อง');
    }

    var version = typeof payload.version === 'number' ? Math.floor(payload.version) : -1;
    if (version < 1 || version > 100000) {
      return createErrorResponse('INVALID_VERSION', 'หมายเลขเวอร์ชันไม่ถูกต้อง');
    }

    var idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey.trim() : '';
    if (!idempotencyKey || idempotencyKey.length > 96) {
      return createErrorResponse('INVALID_IDEMPOTENCY_KEY', 'รหัสป้องกันข้อมูลซ้ำไม่ถูกต้อง');
    }

    var title = sanitizeText(payload.title, CONFIG.MAX_TITLE_LENGTH);
    var author = sanitizeText(payload.author, CONFIG.MAX_AUTHOR_LENGTH);
    var body = sanitizeText(payload.body, CONFIG.MAX_BODY_LENGTH);
    var recoveryState = payload.recoveryState === 'completed' ? 'completed' : 'synced';

    if (!title && !author && !body) {
      return createErrorResponse('EMPTY_CONTENT', 'ยังไม่มีเนื้อหาสำหรับบันทึก');
    }

    // 2. จำกัดความถี่ในการบันทึกเพื่อช่วยลดความเสี่ยงสแปมโควตา
    var cache = CacheService.getScriptCache();
    var globalRateKey = 'global_rate_min_v1';
    var globalCount = Number(cache.get(globalRateKey) || '0');
    if (globalCount >= CONFIG.MAX_GLOBAL_SAVES_PER_MINUTE) {
      return createErrorResponse('RATE_LIMITED', 'ขณะนี้มีคำขอเข้ามาจำนวนมาก กรุณารอสักครู่แล้วลองใหม่');
    }
    cache.put(globalRateKey, String(globalCount + 1), 60);

    var rateKey = 'rate_' + letterId;
    var currentMinuteCount = Number(cache.get(rateKey) || '0');
    if (currentMinuteCount >= CONFIG.MAX_SAVES_PER_MINUTE_PER_LETTER) {
      return createErrorResponse('RATE_LIMITED', 'ส่งข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่');
    }
    cache.put(rateKey, String(currentMinuteCount + 1), 60);

    // 3. ตรวจสอบ Idempotency Cache ป้องกันการบันทึกซ้ำ
    var idemCacheKey = 'idem_' + idempotencyKey;
    var cachedResult = cache.get(idemCacheKey);
    if (cachedResult) {
      return ContentService.createTextOutput(cachedResult).setMimeType(ContentService.MimeType.JSON);
    }

    // 4. ใช้ LockService ป้องกันการเขียนข้อมูลชนกัน
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(CONFIG.LOCK_WAIT_MS)) {
      return createErrorResponse('SERVER_BUSY', 'ระบบกำลังบันทึกข้อมูลอยู่ กรุณาลองใหม่อีกครั้งในอีกสักครู่');
    }

    try {
      var cachedAfterLock = cache.get(idemCacheKey);
      if (cachedAfterLock) {
        return ContentService.createTextOutput(cachedAfterLock).setMimeType(ContentService.MimeType.JSON);
      }

      var scriptProps = PropertiesService.getScriptProperties();
      if (letterId.indexOf('ltr_owner_') === 0) {
        try {
          if (Array.isArray(payload.ownerLetters)) {
            scriptProps.setProperty('PUBLIC_OWNER_LETTERS_JSON', JSON.stringify(payload.ownerLetters));
          }
          if (payload.siteCopy && typeof payload.siteCopy === 'object') {
            scriptProps.setProperty('PUBLIC_SITE_COPY_JSON', JSON.stringify(payload.siteCopy));
          }
        } catch (propErr) {
          // Ignore property quota limit if exceeded
        }
      }
      var storage = getOrCreatePrivateStorage(scriptProps);
      var folder = storage.folder;
      var sheet = storage.indexSheet;
      var auditSheet = storage.auditSheet;

      // ป้องกันคำขอเก่าที่ส่งมาช้าทับข้อมูลเวอร์ชันใหม่
      var existingRowInfo = findLetterRowInIndex(sheet, letterId);
      var nowIso = new Date().toISOString();

      if (existingRowInfo && existingRowInfo.version > version) {
        return createJsonResponse({
          ok: true,
          letterId: letterId,
          version: existingRowInfo.version,
          savedAt: existingRowInfo.savedAt || nowIso,
          note: 'newer_version_already_saved'
        });
      }

      if (existingRowInfo && existingRowInfo.idempotencyKey === idempotencyKey) {
        return createJsonResponse({
          ok: true,
          letterId: letterId,
          version: existingRowInfo.version,
          savedAt: existingRowInfo.savedAt || nowIso
        });
      }

      var recordObject = {
        schemaVersion: '1.0',
        letterId: letterId,
        version: version,
        idempotencyKey: idempotencyKey,
        title: title,
        author: author,
        body: body,
        savedAt: nowIso,
        recoveryState: recoveryState
      };

      var jsonString = JSON.stringify(recordObject, null, 2);
      var fileName = 'letter_' + letterId + '.json';
      var driveFileId = existingRowInfo ? existingRowInfo.driveFileId : '';
      var fileObj = null;

      if (driveFileId) {
        try {
          fileObj = DriveApp.getFileById(driveFileId);
          fileObj.setContent(jsonString);
        } catch (missingErr) {
          fileObj = null;
        }
      }

      if (!fileObj) {
        var existingFiles = folder.getFilesByName(fileName);
        if (existingFiles.hasNext()) {
          fileObj = existingFiles.next();
          fileObj.setContent(jsonString);
        } else {
          fileObj = folder.createFile(fileName, jsonString, MimeType.PLAIN_TEXT);
        }
        fileObj.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
        driveFileId = fileObj.getId();
      }

      var safeSheetRow = [
        escapeFormulaInjection(letterId),
        version,
        escapeFormulaInjection(idempotencyKey),
        escapeFormulaInjection(title),
        escapeFormulaInjection(author),
        escapeFormulaInjection(body),
        nowIso,
        escapeFormulaInjection(recoveryState),
        escapeFormulaInjection(driveFileId)
      ];

      if (existingRowInfo) {
        sheet.getRange(existingRowInfo.rowNumber, 1, 1, safeSheetRow.length).setValues([safeSheetRow]);
      } else {
        sheet.appendRow(safeSheetRow);
      }

      auditSheet.appendRow(safeSheetRow);

      var successPayload = JSON.stringify({
        ok: true,
        letterId: letterId,
        version: version,
        savedAt: nowIso
      });

      cache.put(idemCacheKey, successPayload, 21600);
      return ContentService.createTextOutput(successPayload).setMimeType(ContentService.MimeType.JSON);
    } finally {
      lock.releaseLock();
    }
  } catch (unexpectedErr) {
    console.error('Internal save error occurred');
    return createErrorResponse('INTERNAL_ERROR', 'ระบบไม่สามารถบันทึกข้อมูลได้ชั่วคราว กรุณาลองใหม่อีกครั้ง');
  }
}

function getOrCreatePrivateStorage(scriptProps) {
  var folderId = scriptProps.getProperty('DRIVE_FOLDER_ID') || CONFIG.TARGET_FOLDER_ID;
  var folder = null;

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
      folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      scriptProps.setProperty('DRIVE_FOLDER_ID', folder.getId());
    } catch (e) {
      throw new Error('ไม่สามารถเข้าถึงโฟลเดอร์ปลายทาง ' + folderId + ' ได้ กรุณาใช้บัญชี Google เจ้าของโฟลเดอร์');
    }
  }

  if (!folder) {
    folder = DriveApp.createFolder(CONFIG.DEFAULT_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    scriptProps.setProperty('DRIVE_FOLDER_ID', folder.getId());
  }

  var spreadsheetId = scriptProps.getProperty('SPREADSHEET_ID');
  var ss = null;

  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      ss = null;
    }
  }

  if (!ss) {
    var existingSheets = folder.getFilesByName(CONFIG.DEFAULT_SHEET_NAME);
    if (existingSheets.hasNext()) {
      var foundSheetFile = existingSheets.next();
      ss = SpreadsheetApp.openById(foundSheetFile.getId());
      scriptProps.setProperty('SPREADSHEET_ID', ss.getId());
    } else {
      ss = SpreadsheetApp.create(CONFIG.DEFAULT_SHEET_NAME);
      var ssFile = DriveApp.getFileById(ss.getId());
      ssFile.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      folder.addFile(ssFile);
      try {
        DriveApp.getRootFolder().removeFile(ssFile);
      } catch (rootRemoveErr) {
        // Ignore if root removal is restricted
      }
      scriptProps.setProperty('SPREADSHEET_ID', ss.getId());
    }
  }

  var headers = [
    'letter_id',
    'latest_version',
    'idempotency_key',
    'title',
    'author',
    'body',
    'saved_at_iso',
    'recovery_state',
    'drive_file_id'
  ];

  var indexSheet = ss.getSheetByName('LettersIndex');
  if (!indexSheet) {
    indexSheet = ss.getSheets()[0];
    indexSheet.setName('LettersIndex');
    indexSheet.appendRow(headers);
  }

  var auditSheet = ss.getSheetByName('VersionHistory');
  if (!auditSheet) {
    auditSheet = ss.insertSheet('VersionHistory');
    auditSheet.appendRow(headers);
  }

  return {
    folder: folder,
    indexSheet: indexSheet,
    auditSheet: auditSheet
  };
}

function findLetterRowInIndex(sheet, letterId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === letterId) {
      return {
        rowNumber: i + 2,
        version: Number(values[i][1] || 0),
        idempotencyKey: String(values[i][2] || ''),
        savedAt: String(values[i][6] || ''),
        driveFileId: String(values[i][8] || '')
      };
    }
  }
  return null;
}

function sanitizeText(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val.replace(/\r\n/g, '\n').replace(/\u0000/g, '').slice(0, maxLen);
}

function escapeFormulaInjection(str) {
  var text = String(str || '');
  if (/^[=+\-@]/.test(text)) {
    return "'" + text;
  }
  return text;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function createErrorResponse(code, message) {
  return createJsonResponse({
    ok: false,
    errorCode: code,
    message: message
  });
}

/**
 * กด Run ฟังก์ชันนี้ 1 ครั้งในหน้า Editor เพื่อกดอนุญาตสิทธิ์เข้าถึงโฟลเดอร์ Google Drive
 */
function authorizePermissionsOnce() {
  var folder = DriveApp.getFolderById(CONFIG.TARGET_FOLDER_ID);
  Logger.log('เชื่อมต่อโฟลเดอร์สำเร็จ: ' + folder.getName());
}
