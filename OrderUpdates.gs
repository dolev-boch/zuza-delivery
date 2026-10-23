// ============================================================================
// ZUZA PATISSERIE - ORDER UPDATE REQUESTS
// ----------------------------------------------------------------------------
// When an order already exists for a day, a second submission for that day is
// NEVER written into the day sheet. It is stored here as an update request,
// Shalev gets an email with an approval link, and only after he approves are
// the quantities in the day sheet REPLACED (not added / subtracted).
//
// Self-contained on purpose: relies only on globals that Code.gs /
// CustomProducts.gs already define (SPREADSHEET_ID, EMAIL_RECIPIENT, COLUMNS,
// LOCK_TIMEOUT, getIsraeliTime, createJsonResponse, getCombinedProductMap,
// getCustomProductsStartRow).
// ============================================================================

const UPDATES_SHEET_NAME = 'בקשות עדכון';
const APPROVE_URL = 'https://zuza-delivery.vercel.app/approve.html';
const SUBMISSION_CACHE_SECONDS = 21600; // 6h — max allowed by CacheService

const UPDATE_COLS = {
  REQUEST_ID: 1,
  TOKEN: 2,
  CREATED_AT: 3,
  DELIVERY_DATE: 4,
  DAY: 5,
  FILLER_NAME: 6,
  CERTIFICATE_NUMBER: 7,
  PRODUCTS_JSON: 8,
  STATUS: 9,
  APPROVED_AT: 10,
  SUBMISSION_ID: 11
};
const UPDATE_HEADERS = [
  'מזהה בקשה', 'טוקן', 'נוצר', 'תאריך משלוח', 'גיליון', 'ממלא', 'מספר תעודה',
  'מוצרים (JSON)', 'סטטוס', 'אושר בתאריך', 'מזהה שליחה'
];

// Product rows: base catalog + permanent ("מוצר קבוע") products, and the row
// where free-text "אחרים" products start — both dynamic (CustomProducts.gs).
function ouProductMap() {
  return typeof getCombinedProductMap === 'function' ? getCombinedProductMap() : PRODUCT_ROW_MAP;
}

function ouCustomStartRow() {
  return typeof getCustomProductsStartRow === 'function'
    ? getCustomProductsStartRow()
    : CUSTOM_PRODUCTS_START_ROW;
}

// ============================================================================
// ROUTING (called from doPost / doGet / handleDeliverySubmission in Code.gs)
// ============================================================================

/**
 * doGet hook. Returns a response for the actions this module owns, or null so
 * doGet continues with its own actions.
 */
function handleOrderUpdatesGet(e) {
  const p = (e && e.parameter) || {};
  switch (p.action) {
    case 'check_day':
      return createJsonResponse(checkDayStatus(p.date, p.submission_id));
    case 'get_update_request':
      return createJsonResponse(getUpdateRequestForApproval(p.id, p.token));
    case 'approve_update':
      return createJsonResponse(approveUpdateRequest(p.id, p.token));
    default:
      return null;
  }
}

/** doPost hook for action === 'update_request'. */
function handleUpdateRequest(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT)) {
    return createJsonResponse({ success: false, error: 'System busy, please try again' });
  }
  let routeToNewOrder = false;
  try {
    const remembered = recallSubmission(data.submission_id);
    if (remembered) return createJsonResponse(remembered);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const day = dayFromDeliveryDate(data.delivery_date);
    const sheet = day && ss.getSheetByName(day);
    if (!sheet) {
      return createJsonResponse({ success: false, error: 'Sheet for day ' + day + ' not found' });
    }

    if (dayHasExistingOrder(sheet, data.delivery_date)) {
      return createJsonResponse(saveUpdateRequest(ss, sheet, data, day));
    }
    // The form thought the day already had an order, but it doesn't (e.g. the
    // month was reset meanwhile) — process it as a regular first order.
    routeToNewOrder = true;
  } finally {
    lock.releaseLock();
  }
  if (routeToNewOrder) {
    const copy = Object.assign({}, data);
    delete copy.action;
    return handleDeliverySubmission(copy);
  }
}

// ============================================================================
// DAY STATUS
// ============================================================================

function dayFromDeliveryDate(deliveryDate) {
  const parts = String(deliveryDate || '').trim().split('/');
  if (parts.length !== 3) return '';
  const d = parseInt(parts[0], 10);
  if (!(d >= 1 && d <= 31)) return '';
  return d < 10 ? '0' + d : String(d);
}

/** Returns [day, month, year] numbers, or null. Accepts Date or 'dd/mm/yyyy'. */
function dateParts(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return [value.getDate(), value.getMonth() + 1, value.getFullYear()];
  }
  const m = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)] : null;
}

/**
 * True when the day sheet already holds an order for this same date.
 * F2 may have been auto-converted to a Date by Sheets with a US locale
 * (dd/mm read as mm/dd), so a day/month-swapped match also counts.
 * A leftover order from a different month (sheet not reset) does not count.
 */
function dayHasExistingOrder(sheet, deliveryDate) {
  const info = sheet.getRange(2, COLUMNS.DATE, 1, 4).getValues()[0];
  const existingSubmissionId = String(info[3] || '').trim();
  if (!existingSubmissionId) return false;

  const existing = dateParts(info[0]);
  const requested = dateParts(deliveryDate);
  if (!existing || !requested) return true;

  const same = existing[0] === requested[0] && existing[1] === requested[1] && existing[2] === requested[2];
  const swapped = existing[0] === requested[1] && existing[1] === requested[0] && existing[2] === requested[2];
  return same || swapped;
}

/**
 * GET check_day: lets the form warn the orderer before they fill anything in,
 * and lets it verify whether a submission with an unreadable response landed.
 */
function checkDayStatus(deliveryDate, submissionId) {
  const day = dayFromDeliveryDate(deliveryDate);
  if (!day) return { success: false, error: 'Invalid date' };

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(day);
  if (!sheet) return { success: false, error: 'Sheet not found' };

  const exists = dayHasExistingOrder(sheet, deliveryDate);
  const result = { success: true, exists: exists, own_submission: null };

  if (submissionId) {
    const currentId = String(sheet.getRange(2, COLUMNS.SUBMISSION_ID).getValue() || '').trim();
    if (currentId === String(submissionId)) {
      result.own_submission = 'order';
    } else if (findUpdateRowBySubmission(ss, submissionId)) {
      result.own_submission = 'update_request';
    }
  }
  return result;
}

// ============================================================================
// IDEMPOTENCY — the same submission_id is processed at most once
// ============================================================================

function rememberSubmission(submissionId, response) {
  if (!submissionId) return;
  try {
    CacheService.getScriptCache().put('sub_' + submissionId, JSON.stringify(response), SUBMISSION_CACHE_SECONDS);
  } catch (err) {
    Logger.log('rememberSubmission failed: ' + err);
  }
}

function recallSubmission(submissionId) {
  if (!submissionId) return null;
  try {
    const cached = CacheService.getScriptCache().get('sub_' + submissionId);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    return null;
  }
}

// ============================================================================
// SAVING A REQUEST (caller holds the script lock)
// ============================================================================

function getUpdatesSheet(ss) {
  let sheet = ss.getSheetByName(UPDATES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(UPDATES_SHEET_NAME);
    sheet.getRange(1, 1, 1, UPDATE_HEADERS.length).setValues([UPDATE_HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readUpdateRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, UPDATE_HEADERS.length).getValues()
    .map(function(values, i) { return { row: i + 2, values: values }; });
}

function findUpdateRowBySubmission(ss, submissionId) {
  const sheet = ss.getSheetByName(UPDATES_SHEET_NAME);
  if (!sheet || !submissionId) return null;
  return readUpdateRows(sheet).find(function(r) {
    return String(r.values[UPDATE_COLS.SUBMISSION_ID - 1]) === String(submissionId);
  }) || null;
}

function findUpdateRow(sheet, requestId, token) {
  if (!requestId || !token) return null;
  return readUpdateRows(sheet).find(function(r) {
    return String(r.values[UPDATE_COLS.REQUEST_ID - 1]) === String(requestId) &&
           String(r.values[UPDATE_COLS.TOKEN - 1]) === String(token);
  }) || null;
}

function sanitizeRequestedProducts(products) {
  if (!Array.isArray(products)) return [];
  return products
    .map(function(p) {
      return {
        key: String(p.key || ''),
        name: String(p.name || '').trim(),
        category: String(p.category || ''),
        quantity: Math.max(0, parseInt(p.quantity, 10) || 0),
        notes: String(p.notes || '')
      };
    })
    .filter(function(p) { return p.name; });
}

function saveUpdateRequest(ss, daySheet, data, day) {
  const products = sanitizeRequestedProducts(data.products);
  if (products.length === 0) {
    return { success: false, error: 'No products in update request' };
  }

  const updatesSheet = getUpdatesSheet(ss);
  const existing = findUpdateRowBySubmission(ss, data.submission_id);
  if (existing) {
    return {
      success: true,
      mode: 'update_request',
      message: 'Already processed',
      request_id: existing.values[UPDATE_COLS.REQUEST_ID - 1]
    };
  }

  const requestId = Utilities.getUuid();
  const token = Utilities.getUuid().replace(/-/g, '');
  const createdAt = getIsraeliTime();

  const row = [];
  row[UPDATE_COLS.REQUEST_ID - 1] = requestId;
  row[UPDATE_COLS.TOKEN - 1] = token;
  row[UPDATE_COLS.CREATED_AT - 1] = createdAt;
  row[UPDATE_COLS.DELIVERY_DATE - 1] = data.delivery_date;
  row[UPDATE_COLS.DAY - 1] = day;
  row[UPDATE_COLS.FILLER_NAME - 1] = data.filler_name || '';
  row[UPDATE_COLS.CERTIFICATE_NUMBER - 1] = data.certificate_number || '';
  row[UPDATE_COLS.PRODUCTS_JSON - 1] = JSON.stringify(products);
  row[UPDATE_COLS.STATUS - 1] = 'pending';
  row[UPDATE_COLS.APPROVED_AT - 1] = '';
  row[UPDATE_COLS.SUBMISSION_ID - 1] = data.submission_id || '';

  const newRow = updatesSheet.getLastRow() + 1;
  // Plain text so Sheets never reinterprets dates / ids
  updatesSheet.getRange(newRow, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  SpreadsheetApp.flush();

  const current = currentQuantitiesFor(daySheet, products);
  const approveLink = APPROVE_URL + '?id=' + encodeURIComponent(requestId) + '&token=' + encodeURIComponent(token);
  let emailSent = false;
  try {
    sendUpdateRequestEmail(data, products, current, approveLink);
    emailSent = true;
  } catch (err) {
    Logger.log('Update request email failed: ' + err);
  }

  const response = {
    success: true,
    mode: 'update_request',
    message: 'Update request saved, waiting for approval',
    request_id: requestId,
    emailSent: emailSent
  };
  rememberSubmission(data.submission_id, response);
  return response;
}

// ============================================================================
// SHEET LOOKUPS
// ============================================================================

/**
 * Finds the sheet row for a requested product.
 * Catalog products (base + permanent): their mapped row when column A there holds that name
 * (needed for names that exist twice, e.g. "פאדג' שוקולד"), otherwise the
 * first row with that name above the custom area.
 * Anything else (free-text "אחרים" products): the first row anywhere in the
 * sheet with that name.
 */
function findProductRow(colA, product, productMap, customStartRow) {
  const info = productMap[product.key];
  const isRegular = info && !String(product.key).startsWith('custom_');
  const name = isRegular ? info.name : product.name;

  if (isRegular) {
    const mapped = info.row;
    if (colA[mapped - 2] !== undefined && String(colA[mapped - 2]).trim() === name) return mapped;
    for (let i = 0; i < colA.length && i + 2 < customStartRow; i++) {
      if (String(colA[i]).trim() === name) return i + 2;
    }
    return null;
  }
  for (let i = 0; i < colA.length; i++) {
    if (String(colA[i]).trim() === name) return i + 2;
  }
  return null;
}

function readColumnA(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, COLUMNS.PRODUCT_NAME, lastRow - 1, 1).getValues().map(function(r) { return r[0]; });
}

function currentQuantitiesFor(sheet, products) {
  const colA = readColumnA(sheet);
  const lastRow = sheet.getLastRow();
  const qty = lastRow >= 2 ? sheet.getRange(2, COLUMNS.QUANTITY, lastRow - 1, 1).getValues() : [];
  const productMap = ouProductMap();
  const customStartRow = ouCustomStartRow();
  return products.map(function(p) {
    const row = findProductRow(colA, p, productMap, customStartRow);
    return row ? (parseInt(qty[row - 2][0], 10) || 0) : 0;
  });
}

// ============================================================================
// APPROVAL
// ============================================================================

function parseStoredRequest(r) {
  const v = r.values;
  let products = [];
  try { products = JSON.parse(v[UPDATE_COLS.PRODUCTS_JSON - 1] || '[]'); } catch (err) {}
  return {
    request_id: v[UPDATE_COLS.REQUEST_ID - 1],
    created_at: String(v[UPDATE_COLS.CREATED_AT - 1] || ''),
    delivery_date: String(v[UPDATE_COLS.DELIVERY_DATE - 1] || ''),
    day: String(v[UPDATE_COLS.DAY - 1] || ''),
    filler_name: v[UPDATE_COLS.FILLER_NAME - 1],
    certificate_number: v[UPDATE_COLS.CERTIFICATE_NUMBER - 1],
    status: v[UPDATE_COLS.STATUS - 1] || 'pending',
    approved_at: String(v[UPDATE_COLS.APPROVED_AT - 1] || ''),
    products: products
  };
}

function normalizeDayName(day) {
  const d = parseInt(day, 10);
  return d < 10 ? '0' + d : String(d);
}

function getUpdateRequestForApproval(requestId, token) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const updatesSheet = ss.getSheetByName(UPDATES_SHEET_NAME);
  const found = updatesSheet && findUpdateRow(updatesSheet, requestId, token);
  if (!found) return { success: false, error: 'Request not found' };

  const req = parseStoredRequest(found);
  const daySheet = ss.getSheetByName(normalizeDayName(req.day));
  const current = daySheet ? currentQuantitiesFor(daySheet, req.products) : req.products.map(function() { return 0; });

  return {
    success: true,
    request: {
      delivery_date: req.delivery_date,
      created_at: req.created_at,
      filler_name: req.filler_name,
      certificate_number: req.certificate_number,
      status: req.status,
      approved_at: req.approved_at,
      products: req.products.map(function(p, i) {
        return { name: p.name, category: p.category, current_quantity: current[i], new_quantity: p.quantity };
      })
    }
  };
}

function approveUpdateRequest(requestId, token) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT)) return { success: false, error: 'System busy, please try again' };
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const updatesSheet = ss.getSheetByName(UPDATES_SHEET_NAME);
    const found = updatesSheet && findUpdateRow(updatesSheet, requestId, token);
    if (!found) return { success: false, error: 'Request not found' };

    const req = parseStoredRequest(found);
    if (req.status === 'approved') {
      return { success: true, already_approved: true, approved_at: req.approved_at };
    }

    const daySheet = ss.getSheetByName(normalizeDayName(req.day));
    if (!daySheet) return { success: false, error: 'Sheet for day ' + req.day + ' not found' };

    const approvedAt = getIsraeliTime();
    const applied = applyReplacementQuantities(daySheet, req.products, approvedAt);

    updatesSheet.getRange(found.row, UPDATE_COLS.STATUS).setValue('approved');
    updatesSheet.getRange(found.row, UPDATE_COLS.APPROVED_AT).setNumberFormat('@').setValue(approvedAt);
    SpreadsheetApp.flush();

    return { success: true, approved_at: approvedAt, applied: applied };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sets each product's quantity to EXACTLY the requested value (replace, never
 * add/subtract). Custom products missing from the sheet are appended.
 */
function applyReplacementQuantities(sheet, products, approvedAt) {
  const colA = readColumnA(sheet);
  const productMap = ouProductMap();
  const customStartRow = ouCustomStartRow();
  let appendRow = Math.max(sheet.getLastRow() + 1, customStartRow);
  const applied = [];

  products.forEach(function(p) {
    const newQty = Math.max(0, parseInt(p.quantity, 10) || 0);
    let row = findProductRow(colA, p, productMap, customStartRow);
    let before = 0;

    if (row) {
      before = parseInt(sheet.getRange(row, COLUMNS.QUANTITY).getValue(), 10) || 0;
      const currentNotes = String(sheet.getRange(row, COLUMNS.NOTES).getValue() || '');
      const note = 'עדכון מאושר ' + approvedAt + ': ' + before + ' → ' + newQty;
      sheet.getRange(row, COLUMNS.QUANTITY).setValue(newQty);
      sheet.getRange(row, COLUMNS.NOTES).setValue(currentNotes ? currentNotes + ' | ' + note : note);
    } else {
      if (String(p.key).startsWith('custom_') === false && productMap[p.key]) {
        Logger.log('applyReplacementQuantities: regular product not found in sheet: ' + p.name);
        applied.push({ name: p.name, before: null, after: null, skipped: true });
        return;
      }
      row = appendRow++;
      sheet.getRange(row, COLUMNS.PRODUCT_NAME, 1, 4)
        .setValues([[p.name, 'אחרים', newQty, 'נוסף בעדכון מאושר ' + approvedAt]]);
      colA[row - 2] = p.name;
    }

    sheet.getRange(row, COLUMNS.PRODUCT_NAME, 1, 5).setBackground(newQty > 0 ? '#FFF2CC' : null);
    sheet.getRange(row, COLUMNS.QUANTITY).setFontWeight(newQty > 0 ? 'bold' : 'normal');
    applied.push({ name: p.name, before: before, after: newQty });
  });

  SpreadsheetApp.flush();
  return applied;
}

// ============================================================================
// EMAIL TO SHALEV
// ============================================================================

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildUpdateRequestEmail(data, products, current, approveLink) {
  const subject = 'בקשת עדכון להזמנה של ' + data.delivery_date + ' - ממתינה לאישורך';

  const rows = products.map(function(p, i) {
    return '<tr>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;">' + escapeHtml(p.name) + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;color:#888;">' + current[i] + '</td>' +
      '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;">' + p.quantity + '</td>' +
      '</tr>';
  }).join('');

  const html =
    '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>' +
    '<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;direction:rtl;">' +
    '<div style="max-width:700px;margin:0 auto;background:white;">' +
    '<div style="background:#1a2f2f;padding:24px;text-align:center;">' +
    '<div style="color:#c4a575;font-size:30px;font-family:Georgia,serif;font-style:italic;">Zuza</div>' +
    '<div style="color:#c4a575;font-size:18px;margin-top:10px;">בקשת עדכון להזמנה קיימת</div></div>' +
    '<div style="padding:20px;">' +
    '<p style="font-size:15px;">היי שליו, התקבלה בקשה לעדכן את ההזמנה של <b>' + escapeHtml(data.delivery_date) + '</b>' +
    (data.filler_name ? ' (מאת ' + escapeHtml(data.filler_name) + ')' : '') + '.</p>' +
    '<p style="font-size:14px;color:#555;">הכמויות החדשות <b>מחליפות</b> את הכמויות הנוכחיות בקובץ (לא מתווספות אליהן). ' +
    'שום דבר לא ישתנה בקובץ עד שתאשר.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin-top:12px;">' +
    '<thead><tr style="background:#f5f5f5;">' +
    '<th style="padding:10px;text-align:right;">מוצר</th>' +
    '<th style="padding:10px;text-align:center;">כמות נוכחית</th>' +
    '<th style="padding:10px;text-align:center;">כמות מעודכנת</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="text-align:center;margin:30px 0;">' +
    '<a href="' + approveLink + '" style="display:inline-block;background:#4caf50;color:white;padding:16px 36px;' +
    'text-decoration:none;border-radius:8px;font-size:18px;font-weight:bold;">לצפייה ואישור השינויים</a></div>' +
    '</div></div></body></html>';

  const plain =
    'היי שליו, התקבלה בקשה לעדכן את ההזמנה של ' + data.delivery_date + '.\n' +
    'הכמויות החדשות מחליפות את הכמויות הנוכחיות בקובץ.\n\n' +
    products.map(function(p, i) { return '• ' + p.name + ': ' + current[i] + ' → ' + p.quantity; }).join('\n') +
    '\n\nלאישור השינויים:\n' + approveLink;

  return { subject: subject, html: html, plain: plain };
}

function sendUpdateRequestEmail(data, products, current, approveLink) {
  const email = buildUpdateRequestEmail(data, products, current, approveLink);
  const options = { htmlBody: email.html, name: 'זוזה פטיסרי - מערכת משלוחים' };
  try {
    GmailApp.sendEmail(EMAIL_RECIPIENT, email.subject, email.plain, options);
  } catch (err) {
    MailApp.sendEmail({ to: EMAIL_RECIPIENT, subject: email.subject, body: email.plain,
                        htmlBody: email.html, name: options.name });
  }
}
