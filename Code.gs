// ============================================================================
// ZUZA PATISSERIE - DELIVERY MANAGEMENT SYSTEM
// Google Apps Script - COMPLETE VERSION WITH HANUKKAH 2025
// ============================================================================

// CONFIGURATION
const SPREADSHEET_ID = '1U6u_j9lsTwDQ52mnJWJM1eIZ2CqbmqiwBqEQnD21Ia4';
const EMAIL_RECIPIENT = '6b1b9b@gmail.com';
const EMAIL_MANAGER = 'zuzatiberias@gmail.com';
const CONFIRMATION_URL = 'https://zuza-delivery.vercel.app/confirm.html';

// System constants
const LOCK_TIMEOUT = 30000;
const MAX_EMAIL_RETRIES = 3;
const EMAIL_RETRY_DELAY = 1000;

// Sheet structure constants
const HANUKKAH_START_ROW = 80;
const HANUKKAH_END_ROW = 89;
const CUSTOM_PRODUCTS_START_ROW = 91; // Row 90 is blank separator, 91+ for אחרים
const FIRST_HANUKKAH_SHEET = 10;
const LAST_HANUKKAH_SHEET = 31;
const SUMMARY_SHEET_NAME = 'סיכום חודש';
const SUMMARY_HANUKKAH_START_ROW = 81;

// Column definitions
const COLUMNS = {
  PRODUCT_NAME: 1,
  CATEGORY: 2,
  QUANTITY: 3,
  NOTES: 4,
  LAST_UPDATED: 5,
  DATE: 6,
  CERTIFICATE_NUMBER: 7,
  FILLER_NAME: 8,
  SUBMISSION_ID: 9,
  CONFIRMATION_STATUS: 10,
  CONFIRMATION_TIME: 11
};

// ============================================================================
// MAIN HANDLERS
// ============================================================================

function doPost(e) {
  try {
    if (!e || !e.postData) {
      return testFunction();
    }

    const data = JSON.parse(e.postData.contents);
    Logger.log('Received request: ' + JSON.stringify(data));

    if (data.action === 'confirm') {
      return handleConfirmation(data);
    } else if (data.action === 'get_products_list') {
      return handleGetProductsList();
    } else {
      return handleDeliverySubmission(data);
    }

  } catch (error) {
    Logger.log('ERROR in doPost: ' + error.toString());
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'get_delivery') {
      const day = e.parameter.day;
      const submissionId = e.parameter.submission_id;

      if (!day || !submissionId) {
        return createJsonResponse({ success: false, error: 'Missing parameters' });
      }

      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName(day);

      if (!sheet) {
        return createJsonResponse({ success: false, error: 'Sheet not found' });
      }

      const deliveryData = getDeliveryData(sheet, submissionId);
      return createJsonResponse({ success: true, data: deliveryData });
    }

    if (action === 'get_products_list') {
      return handleGetProductsList();
    }

    return createJsonResponse({ success: true, message: 'API is working' });

  } catch (error) {
    Logger.log('ERROR in doGet: ' + error.toString());
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

// ============================================================================
// CUSTOM MENU
// ============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('סיכום חודש')
    .addItem('עדכון סיכום חודש', 'manualUpdateSummarySheet')
    .addToUi();
}

function manualUpdateSummarySheet() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'עדכון סיכום חודש',
    'האם אתה בטוח שברצונך לעדכן את גיליון הסיכום?\n\nפעולה זו תסרוק את כל הגיליונות ותעדכן את הכמויות.',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    try {
      updateSummarySheet();
      ui.alert('הצלחה!', 'גיליון הסיכום עודכן בהצלחה.', ui.ButtonSet.OK);
    } catch (error) {
      ui.alert('שגיאה', 'אירעה שגיאה בעדכון הגיליון:\n' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function handleGetProductsList() {
  try {
    const products = [];

    Object.entries(PRODUCT_ROW_MAP).forEach(([key, info]) => {
      products.push({
        key: key,
        name: info.name,
        category: info.category,
        row: info.row
      });
    });

    return createJsonResponse({ success: true, products: products });
  } catch (error) {
    Logger.log('ERROR in handleGetProductsList: ' + error.toString());
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// DELIVERY SUBMISSION HANDLER
// ============================================================================

function handleDeliverySubmission(data) {
  const lock = LockService.getScriptLock();

  try {
    Logger.log('Attempting to acquire lock...');
    if (!lock.tryLock(LOCK_TIMEOUT)) {
      throw new Error('System busy, please try again');
    }
    Logger.log('Lock acquired');

    const actualSubmissionTime = getIsraeliTime();
    Logger.log('Actual submission time captured: ' + actualSubmissionTime);

    const deliveryDate = data.delivery_date;
    if (!deliveryDate) {
      throw new Error('Missing delivery_date');
    }

    const day = deliveryDate.split('/')[0];
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(day);

    if (!sheet) {
      throw new Error(`Sheet for day ${day} not found`);
    }

    const existingSubmissionId = sheet.getRange(2, COLUMNS.SUBMISSION_ID).getValue();
    if (existingSubmissionId === data.submission_id) {
      Logger.log('Duplicate submission detected: ' + data.submission_id);
      return createJsonResponse({ success: true, message: 'Already processed' });
    }

    Logger.log('Updating delivery data...');
    updateDeliveryData(sheet, data, actualSubmissionTime);
    Logger.log('Data updated successfully');

    SpreadsheetApp.flush();
    Logger.log('Data flushed to sheet');

    Logger.log('Sending confirmation email...');
    const emailSent = sendConfirmationEmailWithRetry(data, sheet, day);
    Logger.log('Email sent status: ' + emailSent);

    return createJsonResponse({
      success: true,
      message: 'Delivery recorded',
      emailSent: emailSent
    });

  } catch (error) {
    Logger.log('ERROR in handleDeliverySubmission: ' + error.toString());
    throw error;
  } finally {
    lock.releaseLock();
    Logger.log('Lock released');
  }
}

// ============================================================================
// CONFIRMATION HANDLER
// ============================================================================

function handleConfirmation(data) {
  const lock = LockService.getScriptLock();

  try {
    Logger.log('Confirmation - Attempting to acquire lock...');
    if (!lock.tryLock(LOCK_TIMEOUT)) {
      throw new Error('System busy, please try again');
    }
    Logger.log('Confirmation - Lock acquired');

    const day = data.day;
    const submissionId = data.submission_id;
    const confirmedProducts = data.confirmed_products;
    const fullConfirmation = data.full_confirmation;

    if (!day || !submissionId) {
      throw new Error('Missing confirmation data');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(day);

    if (!sheet) {
      throw new Error(`Sheet for day ${day} not found`);
    }

    const currentStatus = sheet.getRange(2, COLUMNS.CONFIRMATION_STATUS).getValue();
    if (currentStatus === 'confirmed' || currentStatus === 'confirmed_with_changes') {
      Logger.log('RE-CONFIRMATION detected for: ' + submissionId + ' - Previous status: ' + currentStatus);
    }

    Logger.log('Processing confirmation...');

    const originalQuantities = getOriginalQuantities(sheet);
    Logger.log('Original quantities captured: ' + JSON.stringify(originalQuantities));

    const changedProducts = processConfirmation(sheet, confirmedProducts, fullConfirmation, submissionId, originalQuantities);
    Logger.log('Confirmation processed. Changed products: ' + changedProducts.length);

    SpreadsheetApp.flush();

    Logger.log('Sending manager confirmation email...');
    const emailSent = sendManagerEmailWithRetry(sheet, day, fullConfirmation, confirmedProducts, changedProducts);
    Logger.log('Manager email sent status: ' + emailSent);

    return createJsonResponse({
      success: true,
      message: 'Confirmation processed',
      emailSent: emailSent
    });

  } catch (error) {
    Logger.log('ERROR in handleConfirmation: ' + error.toString());
    throw error;
  } finally {
    lock.releaseLock();
    Logger.log('Confirmation - Lock released');
  }
}

// ============================================================================
// DATE/TIME UTILITIES
// ============================================================================

function getIsraeliTime() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const partsMap = {};
  parts.forEach(part => {
    partsMap[part.type] = part.value;
  });

  return `${partsMap.day}/${partsMap.month}/${partsMap.year} ${partsMap.hour}:${partsMap.minute}`;
}

// ============================================================================
// DATA RETRIEVAL
// ============================================================================

function getDeliveryData(sheet, submissionId) {
  const generalInfo = sheet.getRange(2, COLUMNS.DATE, 1, 6).getValues()[0];

  if (generalInfo[3] !== submissionId) {
    throw new Error('Submission ID mismatch');
  }

  const submissionTimeCell = sheet.getRange(2, COLUMNS.LAST_UPDATED);
  const submissionTime = submissionTimeCell.getValue() || 'N/A';

  Logger.log('Retrieved submission time from E2: ' + submissionTime);

  const products = getProductsFromSheet(sheet);

  return {
    delivery_date: generalInfo[0],
    certificate_number: generalInfo[1],
    filler_name: generalInfo[2],
    submission_id: generalInfo[3],
    confirmation_status: generalInfo[4] || 'pending',
    confirmation_time: generalInfo[5] || '',
    submission_time: submissionTime,
    products: products
  };
}

function getProductsFromSheet(sheet) {
  const products = [];
  const lastProductRow = Math.max(...Object.values(PRODUCT_ROW_MAP).map(p => p.row));
  const productData = sheet.getRange(2, 1, lastProductRow - 1, 5).getValues();

  const rowToKey = {};
  Object.entries(PRODUCT_ROW_MAP).forEach(([key, info]) => {
    rowToKey[info.row] = key;
  });

  productData.forEach((row, index) => {
    const [name, category, quantity, notes, lastUpdated] = row;
    const actualRow = index + 2;
    const key = rowToKey[actualRow];

    if (quantity > 0 && key) {
      products.push({
        key: key,
        name: name,
        category: category,
        quantity: quantity,
        notes: notes || ''
      });
    }
  });

  const lastRow = sheet.getLastRow();
  if (lastRow >= CUSTOM_PRODUCTS_START_ROW) {
    const customData = sheet.getRange(CUSTOM_PRODUCTS_START_ROW, 1, lastRow - CUSTOM_PRODUCTS_START_ROW + 1, 4).getValues();

    customData.forEach((row, index) => {
      const [name, category, quantity, notes] = row;
      if (name && quantity > 0) {
        products.push({
          key: `custom_${index}`,
          name: name,
          category: category || 'אחרים',
          quantity: quantity,
          notes: notes || ''
        });
      }
    });
  }

  Logger.log('Retrieved ' + products.length + ' products from sheet');
  return products;
}

function getOriginalQuantities(sheet) {
  const originalQuantities = {};

  const lastProductRow = Math.max(...Object.values(PRODUCT_ROW_MAP).map(p => p.row));
  const productData = sheet.getRange(2, 1, lastProductRow - 1, 3).getValues();

  const rowToKey = {};
  Object.entries(PRODUCT_ROW_MAP).forEach(([key, info]) => {
    rowToKey[info.row] = key;
  });

  productData.forEach((row, index) => {
    const [name, category, quantity] = row;
    const actualRow = index + 2;
    const key = rowToKey[actualRow];

    if (key && quantity > 0) {
      originalQuantities[key] = {
        name: name,
        quantity: parseInt(quantity) || 0
      };
    }
  });

  const lastRow = sheet.getLastRow();
  if (lastRow >= CUSTOM_PRODUCTS_START_ROW) {
    const customData = sheet.getRange(CUSTOM_PRODUCTS_START_ROW, 1, lastRow - CUSTOM_PRODUCTS_START_ROW + 1, 3).getValues();

    customData.forEach((row, index) => {
      const [name, category, quantity] = row;
      if (name && quantity > 0) {
        const key = `custom_${name}`;
        originalQuantities[key] = {
          name: name,
          quantity: parseInt(quantity) || 0
        };
      }
    });
  }

  return originalQuantities;
}

// ============================================================================
// DATA UPDATE
// ============================================================================

function updateDeliveryData(sheet, data, submissionTime) {
  if (!data.products || !Array.isArray(data.products)) {
    throw new Error('Invalid products data');
  }

  const existingSubmissionTime = sheet.getRange(2, COLUMNS.LAST_UPDATED).getValue();

  if (!existingSubmissionTime) {
    Logger.log('Storing NEW submission time in E2: ' + submissionTime);

    const cell = sheet.getRange(2, COLUMNS.LAST_UPDATED);
    cell.setNumberFormat('@');
    cell.setValue(submissionTime);

    SpreadsheetApp.flush();
    Logger.log('Submission time stored in E2');
  } else {
    Logger.log('PRESERVING existing submission time in E2: ' + existingSubmissionTime);
  }

  const verifyValue = sheet.getRange(2, COLUMNS.LAST_UPDATED).getValue();
  Logger.log('Verification - E2 contains: ' + verifyValue + ' (type: ' + typeof verifyValue + ')');

  const generalInfoRow = [
    data.delivery_date || '',
    data.certificate_number || '',
    data.filler_name || '',
    data.submission_id || '',
    'pending',
    ''
  ];
  sheet.getRange(2, COLUMNS.DATE, 1, 6).setValues([generalInfoRow]);

  const regularProducts = data.products.filter(p => !p.key.startsWith('custom_'));
  const customProducts = data.products.filter(p => p.key.startsWith('custom_'));

  // Check if this sheet should have Hanukkah products (sheets 10-31)
  // Sheet names are like "01", "02", "10", "11", etc.
  const sheetName = sheet.getName();
  const sheetNumber = parseInt(sheetName, 10);
  const isHanukkahSheet = !isNaN(sheetNumber) && sheetNumber >= (FIRST_HANUKKAH_SHEET + 1) && sheetNumber <= (LAST_HANUKKAH_SHEET + 1);

  Logger.log(`Sheet: ${sheetName}, Number: ${sheetNumber}, Is Hanukkah: ${isHanukkahSheet}`);

  Logger.log('Processing ' + regularProducts.length + ' regular products');
  regularProducts.forEach(product => {
    const productInfo = PRODUCT_ROW_MAP[product.key];

    if (productInfo) {
      // Skip Hanukkah products if not in Hanukkah sheets
      if (productInfo.category === 'סופגניות חנוכה 2025' && !isHanukkahSheet) {
        Logger.log(`Skipping Hanukkah product ${productInfo.name} - not in Hanukkah sheet range`);
        return;
      }

      const row = productInfo.row;
      const currentQuantity = parseInt(sheet.getRange(row, COLUMNS.QUANTITY).getValue()) || 0;
      const newQuantity = parseInt(product.quantity) || 0;
      const updatedQuantity = currentQuantity + newQuantity;

      const currentNotes = sheet.getRange(row, COLUMNS.NOTES).getValue() || '';
      const newNotes = product.notes || '';
      let finalNotes = currentNotes && newNotes ? currentNotes + ' | ' + newNotes : currentNotes || newNotes;

      const rowData = [productInfo.name, productInfo.category, updatedQuantity, finalNotes];
      sheet.getRange(row, COLUMNS.PRODUCT_NAME, 1, 4).setValues([rowData]);

      if (updatedQuantity > 0) {
        sheet.getRange(row, COLUMNS.PRODUCT_NAME, 1, 5).setBackground('#FFF2CC');
        sheet.getRange(row, COLUMNS.QUANTITY).setFontWeight('bold');
      }
    }
  });

  if (customProducts.length > 0) {
    Logger.log('Processing ' + customProducts.length + ' custom products');

    // Ensure row 90 is blank separator (only in Hanukkah sheets)
    if (isHanukkahSheet) {
      sheet.getRange(90, COLUMNS.PRODUCT_NAME, 1, 5).clearContent();
      Logger.log('Row 90 set as blank separator');
    }

    let lastRow = Math.max(sheet.getLastRow(), CUSTOM_PRODUCTS_START_ROW - 1);

    customProducts.forEach(product => {
      const productName = product.name;
      let foundRow = null;

      for (let row = CUSTOM_PRODUCTS_START_ROW; row <= lastRow; row++) {
        const existingName = sheet.getRange(row, COLUMNS.PRODUCT_NAME).getValue();
        if (existingName === productName) {
          foundRow = row;
          break;
        }
      }

      if (foundRow) {
        const currentQuantity = parseInt(sheet.getRange(foundRow, COLUMNS.QUANTITY).getValue()) || 0;
        const newQuantity = parseInt(product.quantity) || 0;
        const updatedQuantity = currentQuantity + newQuantity;

        const currentNotes = sheet.getRange(foundRow, COLUMNS.NOTES).getValue() || '';
        const newNotes = product.notes || '';
        let finalNotes = currentNotes && newNotes ? currentNotes + ' | ' + newNotes : currentNotes || newNotes;

        const rowData = [productName, 'אחרים', updatedQuantity, finalNotes];
        sheet.getRange(foundRow, COLUMNS.PRODUCT_NAME, 1, 4).setValues([rowData]);

        if (updatedQuantity > 0) {
          sheet.getRange(foundRow, COLUMNS.PRODUCT_NAME, 1, 5).setBackground('#FFE6CC');
          sheet.getRange(foundRow, COLUMNS.QUANTITY).setFontWeight('bold');
        }
      } else {
        const newRow = lastRow + 1;
        lastRow = newRow;
        const quantity = parseInt(product.quantity) || 0;
        const rowData = [productName, 'אחרים', quantity, product.notes || ''];
        sheet.getRange(newRow, COLUMNS.PRODUCT_NAME, 1, 4).setValues([rowData]);

        if (quantity > 0) {
          sheet.getRange(newRow, COLUMNS.PRODUCT_NAME, 1, 5).setBackground('#FFE6CC');
          sheet.getRange(newRow, COLUMNS.QUANTITY).setFontWeight('bold');
        }
      }
    });
  }

  SpreadsheetApp.flush();
  Logger.log('Data update completed and flushed');

  // NOTE: Summary sheet update removed from here to improve performance
  // Run updateSummarySheet() manually when needed via script menu
}

// ============================================================================
// CONFIRMATION PROCESSING
// ============================================================================

function processConfirmation(sheet, confirmedProducts, fullConfirmation, submissionId, originalQuantities) {
  const currentTime = getIsraeliTime();
  Logger.log('Processing confirmation at: ' + currentTime);

  const changedProducts = [];

  if (fullConfirmation) {
    sheet.getRange(2, COLUMNS.CONFIRMATION_STATUS).setValue('confirmed');
    const confirmCell = sheet.getRange(2, COLUMNS.CONFIRMATION_TIME);
    confirmCell.setNumberFormat('@');
    confirmCell.setValue(currentTime);

    // Paint all products including אחרים (custom products)
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, 5).setBackground('#d4edda');
    }

    Logger.log('Full confirmation processed - no changes made');

  } else {
    sheet.getRange(2, COLUMNS.CONFIRMATION_STATUS).setValue('confirmed_with_changes');
    const confirmCell = sheet.getRange(2, COLUMNS.CONFIRMATION_TIME);
    confirmCell.setNumberFormat('@');
    confirmCell.setValue(currentTime);

    // First, paint all products green (confirmed)
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, 5).setBackground('#d4edda');
    }

    Logger.log('Processing ' + confirmedProducts.length + ' confirmed products with potential changes');

    confirmedProducts.forEach(product => {
      const confirmedQuantity = parseInt(product.quantity) || 0;

      let comparisonKey = product.key;
      if (product.key.startsWith('custom_')) {
        comparisonKey = `custom_${product.name}`;
      }

      const originalData = originalQuantities[comparisonKey];
      const originalQuantity = originalData ? originalData.quantity : 0;

      Logger.log(`Product: ${product.name}, Original: ${originalQuantity}, Confirmed: ${confirmedQuantity}`);

      if (originalQuantity !== confirmedQuantity) {
        Logger.log(`CHANGE DETECTED: ${product.name} changed from ${originalQuantity} to ${confirmedQuantity}`);

        changedProducts.push({
          key: product.key,
          name: product.name,
          category: product.category || (PRODUCT_ROW_MAP[product.key] ? PRODUCT_ROW_MAP[product.key].category : 'אחרים'),
          originalQuantity: originalQuantity,
          confirmedQuantity: confirmedQuantity
        });

        if (product.key.startsWith('custom_')) {
          updateCustomProductConfirmation(sheet, product, currentTime, originalQuantity, confirmedQuantity);
        } else {
          const productInfo = PRODUCT_ROW_MAP[product.key];
          if (productInfo) {
            const row = productInfo.row;

            sheet.getRange(row, COLUMNS.QUANTITY).setValue(confirmedQuantity);

            const currentNotes = sheet.getRange(row, COLUMNS.NOTES).getValue() || '';
            const changeNote = `לפני שינוי: ${originalQuantity}, לאחר שינוי: ${confirmedQuantity}`;
            const finalNotes = currentNotes ? currentNotes + ' | ' + changeNote : changeNote;
            sheet.getRange(row, COLUMNS.NOTES).setValue(finalNotes);
            sheet.getRange(row, COLUMNS.LAST_UPDATED).setValue(currentTime);

            if (confirmedQuantity > 0) {
              sheet.getRange(row, 1, 1, 5).setBackground('#fff3cd');
            }
          }
        }
      } else {
        Logger.log(`NO CHANGE: ${product.name} remains at ${originalQuantity}`);
      }
    });

    Logger.log(`Partial confirmation processed. ${changedProducts.length} products actually changed`);
  }

  SpreadsheetApp.flush();
  return changedProducts;
}

function updateCustomProductConfirmation(sheet, product, currentTime, originalQuantity, confirmedQuantity) {
  const productName = product.name;
  const lastRow = sheet.getLastRow();
  let foundRow = null;

  for (let row = CUSTOM_PRODUCTS_START_ROW; row <= lastRow; row++) {
    const existingName = sheet.getRange(row, COLUMNS.PRODUCT_NAME).getValue();
    if (existingName === productName) {
      foundRow = row;
      break;
    }
  }

  if (foundRow) {
    sheet.getRange(foundRow, COLUMNS.QUANTITY).setValue(confirmedQuantity);

    const currentNotes = sheet.getRange(foundRow, COLUMNS.NOTES).getValue() || '';
    const changeNote = `לפני שינוי: ${originalQuantity}, לאחר שינוי: ${confirmedQuantity}`;
    const finalNotes = currentNotes ? currentNotes + ' | ' + changeNote : changeNote;
    sheet.getRange(foundRow, COLUMNS.NOTES).setValue(finalNotes);
    sheet.getRange(foundRow, COLUMNS.LAST_UPDATED).setValue(currentTime);

    if (confirmedQuantity > 0) {
      sheet.getRange(foundRow, 1, 1, 5).setBackground('#fff3cd');
    }
  }
}

// ============================================================================
// SUMMARY SHEET AUTO-UPDATE
// ============================================================================

function updateSummarySheet() {
  try {
    Logger.log('Starting summary sheet update...');
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);

    if (!summarySheet) {
      Logger.log('Summary sheet not found: ' + SUMMARY_SHEET_NAME);
      return;
    }

    // 1. Update Hanukkah products (rows 81-90 in summary)
    updateHanukkahProductsInSummary(summarySheet, ss);

    // 2. Consolidate and update אחרים products
    updateCustomProductsInSummary(summarySheet, ss);

    SpreadsheetApp.flush();
    Logger.log('Summary sheet updated successfully');
  } catch (error) {
    Logger.log('Error updating summary sheet: ' + error.toString());
  }
}

function updateHanukkahProductsInSummary(summarySheet, ss) {
  Logger.log('Updating Hanukkah products in summary sheet...');

  const hanukkahProducts = [];

  // Get all Hanukkah products from PRODUCT_ROW_MAP
  Object.entries(PRODUCT_ROW_MAP).forEach(([key, info]) => {
    if (info.category === 'סופגניות חנוכה 2025') {
      hanukkahProducts.push({
        name: info.name,
        price: info.price,
        totalQuantity: 0,
        row: info.row
      });
    }
  });

  // Sort by row to maintain order
  hanukkahProducts.sort((a, b) => a.row - b.row);

  // Collect quantities from sheets 10-31
  const allSheets = ss.getSheets();
  for (let i = FIRST_HANUKKAH_SHEET; i <= Math.min(LAST_HANUKKAH_SHEET, allSheets.length - 1); i++) {
    const sheet = allSheets[i];

    // Skip summary sheet
    if (sheet.getName() === SUMMARY_SHEET_NAME) {
      continue;
    }

    hanukkahProducts.forEach(product => {
      const quantity = parseInt(sheet.getRange(product.row, COLUMNS.QUANTITY).getValue()) || 0;
      product.totalQuantity += quantity;
    });
  }

  // Write to summary sheet starting at row 81 using batch update
  const summaryData = hanukkahProducts.map(product => [
    product.name,
    product.price,
    product.totalQuantity
  ]);

  if (summaryData.length > 0) {
    summarySheet.getRange(SUMMARY_HANUKKAH_START_ROW, 1, summaryData.length, 3).setValues(summaryData);
  }

  Logger.log(`Updated ${hanukkahProducts.length} Hanukkah products in summary`);
}

function updateCustomProductsInSummary(summarySheet, ss) {
  Logger.log('Consolidating אחרים products across all sheets...');

  const customProductsMap = {}; // {productName: totalQuantity}

  // Scan all sheets for אחרים products starting from row 91
  const allSheets = ss.getSheets();
  allSheets.forEach((sheet, sheetIndex) => {
    // Skip summary sheet itself
    if (sheet.getName() === SUMMARY_SHEET_NAME) {
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < CUSTOM_PRODUCTS_START_ROW) {
      return;
    }

    // Read all rows from CUSTOM_PRODUCTS_START_ROW to end
    const customData = sheet.getRange(CUSTOM_PRODUCTS_START_ROW, 1, lastRow - CUSTOM_PRODUCTS_START_ROW + 1, 3).getValues();

    customData.forEach(row => {
      const [name, category, quantity] = row;

      // Only process if it's אחרים category and has a name
      if (name && category === 'אחרים' && quantity > 0) {
        if (!customProductsMap[name]) {
          customProductsMap[name] = 0;
        }
        customProductsMap[name] += parseInt(quantity) || 0;
      }
    });
  });

  // Write consolidated אחרים products to summary sheet
  // Start after Hanukkah products (row 91 in summary = 81 + 10)
  const summaryStartRow = SUMMARY_HANUKKAH_START_ROW + 10; // Row 91

  // Clear existing אחרים section first
  const summaryLastRow = summarySheet.getLastRow();
  if (summaryLastRow >= summaryStartRow) {
    summarySheet.getRange(summaryStartRow, 1, summaryLastRow - summaryStartRow + 1, 3).clearContent();
  }

  // Write consolidated products using batch update
  const customProductsList = Object.entries(customProductsMap).sort((a, b) => a[0].localeCompare(b[0], 'he'));

  if (customProductsList.length > 0) {
    const summaryData = customProductsList.map(([productName, totalQuantity]) => [
      productName,
      '', // No price for custom products
      totalQuantity
    ]);

    summarySheet.getRange(summaryStartRow, 1, summaryData.length, 3).setValues(summaryData);
  }

  Logger.log(`Consolidated ${customProductsList.length} unique אחרים products in summary`);
}

// ============================================================================
// EMAIL FUNCTIONS
// ============================================================================

function sendConfirmationEmailWithRetry(formData, sheet, day) {
  for (let attempt = 1; attempt <= MAX_EMAIL_RETRIES; attempt++) {
    try {
      Logger.log('Email attempt ' + attempt + ' of ' + MAX_EMAIL_RETRIES);
      sendConfirmationEmail(formData, sheet, day);
      Logger.log('Email sent successfully on attempt ' + attempt);
      return true;
    } catch (error) {
      Logger.log('Email attempt ' + attempt + ' failed: ' + error.toString());
      if (attempt < MAX_EMAIL_RETRIES) {
        Utilities.sleep(EMAIL_RETRY_DELAY);
      }
    }
  }
  Logger.log('All email attempts failed');
  return false;
}

function sendManagerEmailWithRetry(sheet, day, fullConfirmation, confirmedProducts, changedProducts) {
  for (let attempt = 1; attempt <= MAX_EMAIL_RETRIES; attempt++) {
    try {
      Logger.log('Manager email attempt ' + attempt + ' of ' + MAX_EMAIL_RETRIES);
      sendConfirmationCompleteEmail(sheet, day, fullConfirmation, confirmedProducts, changedProducts);
      Logger.log('Manager email sent successfully on attempt ' + attempt);
      return true;
    } catch (error) {
      Logger.log('Manager email attempt ' + attempt + ' failed: ' + error.toString());
      if (attempt < MAX_EMAIL_RETRIES) {
        Utilities.sleep(EMAIL_RETRY_DELAY);
      }
    }
  }
  Logger.log('All manager email attempts failed');
  return false;
}

function sendConfirmationEmail(formData, sheet, day) {
  const products = getProductsFromSheet(sheet);
  const deliveryDate = formData.delivery_date;
  const confirmationLink = `${CONFIRMATION_URL}?day=${day}&submission_id=${encodeURIComponent(formData.submission_id)}`;

  const subject = `תעודת משלוח מס׳ ${formData.certificate_number} - ${deliveryDate} - מחכה לאישורך`;
  const htmlBody = buildConfirmationEmailHTML(formData, products, confirmationLink);
  const plainBody = buildEmailPlainText(formData, products, confirmationLink);

  try {
    GmailApp.sendEmail(EMAIL_RECIPIENT, subject, plainBody, {
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים'
    });
    Logger.log('Email sent via GmailApp to: ' + EMAIL_RECIPIENT);
  } catch (error) {
    Logger.log('GmailApp failed, trying MailApp: ' + error.toString());
    MailApp.sendEmail({
      to: EMAIL_RECIPIENT,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים'
    });
    Logger.log('Email sent via MailApp to: ' + EMAIL_RECIPIENT);
  }
}

function sendConfirmationCompleteEmail(sheet, day, fullConfirmation, confirmedProducts, changedProducts) {
  const generalInfo = sheet.getRange(2, COLUMNS.DATE, 1, 6).getValues()[0];

  const deliveryDateRaw = generalInfo[0];
  let deliveryDate = '';
  if (deliveryDateRaw instanceof Date) {
    const d = deliveryDateRaw;
    deliveryDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } else {
    deliveryDate = deliveryDateRaw.toString();
  }

  const certNumber = generalInfo[1];
  const fillerName = generalInfo[2];
  const submissionId = generalInfo[3];

  const confirmationTime = generalInfo[5] || getIsraeliTime();
  Logger.log('Manager email - Confirmation time: ' + confirmationTime);

  const submissionTimeCell = sheet.getRange(2, COLUMNS.LAST_UPDATED);
  const submissionTime = submissionTimeCell.getValue() || 'N/A';
  Logger.log('Manager email - Submission time from E2: ' + submissionTime);

  const submissionTimeParts = submissionTime.toString().split(' ');
  const timeStr = submissionTimeParts[1] || '';

  const subject = `תעודת משלוח לתאריך ${deliveryDate} שעה ${timeStr} זוזה פטיסרי כנרת לטבריה אושרה`;

  const htmlBody = buildConfirmationCompleteEmailHTML(
    deliveryDate,
    certNumber,
    fillerName,
    submissionTime,
    confirmationTime,
    fullConfirmation,
    confirmedProducts,
    changedProducts,
    submissionId
  );

  const plainBody = buildConfirmationCompleteEmailPlain(
    deliveryDate,
    certNumber,
    fillerName,
    submissionTime,
    confirmationTime,
    fullConfirmation,
    confirmedProducts,
    changedProducts,
    submissionId
  );

  try {
    GmailApp.sendEmail(EMAIL_MANAGER, subject, plainBody, {
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים'
    });
    Logger.log('Manager email sent via GmailApp to: ' + EMAIL_MANAGER);
  } catch (error) {
    Logger.log('GmailApp failed for manager, trying MailApp: ' + error.toString());
    MailApp.sendEmail({
      to: EMAIL_MANAGER,
      subject: subject,
      body: plainBody,
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים'
    });
    Logger.log('Manager email sent via MailApp to: ' + EMAIL_MANAGER);
  }
}

function buildConfirmationEmailHTML(formData, products, confirmationLink) {
  const categorized = {};

  products.forEach(product => {
    if (!categorized[product.category]) {
      categorized[product.category] = [];
    }
    categorized[product.category].push(product);
  });

  let productsHTML = '';
  Object.keys(categorized).forEach(category => {
    productsHTML += `
      <div style="margin-bottom: 20px;">
        <h3 style="background: #1a2f2f; color: #c4a575; padding: 10px; margin: 0; border-radius: 6px 6px 0 0; font-size: 16px;">
          ${category}
        </h3>
        <table style="width: 100%; border-collapse: collapse; background: white;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">שם מוצר</th>
              <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e0e0e0; width: 80px;">כמות</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e0e0e0;">הערות</th>
            </tr>
          </thead>
          <tbody>
    `;

    categorized[category].forEach((product, index) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
      productsHTML += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0;">${product.name}</td>
          <td style="padding: 10px 12px; text-align: center; border-bottom: 1px solid #f0f0f0; font-weight: bold;">${product.quantity}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f0f0f0; color: #666;">${product.notes || '-'}</td>
        </tr>
      `;
    });

    productsHTML += `</tbody></table></div>`;
  });

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl;">
      <div style="max-width: 700px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #1a2f2f 0%, #2d4a4a 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #c4a575; font-size: 36px; margin: 0; font-family: Georgia, serif; font-style: italic;">Zuza</h1>
          <div style="color: white; font-size: 11px; letter-spacing: 3px; margin-top: 5px;">PATISSERIE</div>
          <div style="color: #c4a575; font-size: 20px; margin-top: 15px;">תעודת משלוח לאישור</div>
        </div>

        <div style="padding: 20px; background: #fff9f0; margin: 20px; border-radius: 8px; border: 2px solid #c4a575;">
          <table style="width: 100%; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">תאריך משלוח:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${formData.delivery_date}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">מספר תעודה:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${formData.certificate_number}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">ממלא התעודה:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${formData.filler_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 600;">סה"כ מוצרים:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${products.length}</td>
            </tr>
          </table>
        </div>

        <div style="padding: 0 20px 20px 20px;">
          <h2 style="color: #1a2f2f; font-size: 20px; margin-bottom: 15px;">פירוט מוצרים למשלוח</h2>
          ${productsHTML}
        </div>

        <div style="padding: 30px; text-align: center; background: #f9f9f9;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">נא לאשר קבלת המוצרים ולעדכן כמויות במידת הצורך</p>
          <a href="${confirmationLink}" style="display: inline-block; background: #4caf50; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);">
            ✓ לאישור התעודה לחץ כאן
          </a>
        </div>

        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 13px; color: #666;">מזהה שליחה: ${formData.submission_id}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">זוזה פטיסרי - מערכת ניהול משלוחים</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildEmailPlainText(formData, products, confirmationLink) {
  return `זוזה פטיסרי - תעודת משלוח

תאריך משלוח: ${formData.delivery_date}
מספר תעודה: ${formData.certificate_number}
ממלא התעודה: ${formData.filler_name}
סה"כ מוצרים: ${products.length}

לאישור התעודה היכנס לקישור:
${confirmationLink}

מזהה שליחה: ${formData.submission_id}

---
זוזה פטיסרי - מערכת ניהול משלוחים`;
}

function buildConfirmationCompleteEmailHTML(deliveryDate, certNumber, fillerName, submissionTime, confirmationTime, fullConfirmation, confirmedProducts, changedProducts, submissionId) {
  let productsHTML = '';

  if (!fullConfirmation && confirmedProducts && confirmedProducts.length > 0) {
    const changedProductsMap = {};
    changedProducts.forEach(product => {
      changedProductsMap[product.key] = product;
    });

    const categorized = {};
    confirmedProducts.forEach(product => {
      const productInfo = PRODUCT_ROW_MAP[product.key] || { category: 'אחרים' };
      const category = productInfo.category;

      if (!categorized[category]) {
        categorized[category] = [];
      }

      const isChanged = changedProductsMap[product.key] !== undefined;
      const changedData = changedProductsMap[product.key];

      categorized[category].push({
        name: product.name,
        key: product.key,
        quantity: product.quantity,
        isChanged: isChanged,
        originalQuantity: changedData ? changedData.originalQuantity : product.quantity,
        confirmedQuantity: product.quantity
      });
    });

    productsHTML = '<div style="margin-top: 30px;">';

    if (changedProducts.length > 0) {
      productsHTML += '<h3 style="color: #d32f2f; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #ff9800; padding-bottom: 8px;">⚠️ שינויים שבוצעו על ידי שלו:</h3>';

      Object.keys(categorized).forEach(category => {
        const changedInCategory = categorized[category].filter(p => p.isChanged);

        if (changedInCategory.length > 0) {
          productsHTML += `
            <div style="margin-bottom: 20px;">
              <h4 style="background: #fff3e0; padding: 10px; border-right: 4px solid #ff9800; margin: 10px 0; font-size: 16px; color: #e65100;">
                ${category}
              </h4>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                <thead>
                  <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: right;">מוצר</th>
                    <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: center; width: 120px;">לפני שינוי</th>
                    <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: center; width: 30px;"></th>
                    <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: center; width: 120px;">לאחר שינוי</th>
                  </tr>
                </thead>
                <tbody>
          `;

          changedInCategory.forEach((product, index) => {
            const bgColor = index % 2 === 0 ? '#fff8e1' : '#ffecb3';
            const difference = product.confirmedQuantity - product.originalQuantity;
            const differenceText = difference > 0 ? `+${difference}` : difference.toString();
            const differenceColor = difference > 0 ? '#2e7d32' : '#c62828';

            productsHTML += `
              <tr style="background: ${bgColor};">
                <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold;">${product.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center; color: #666; text-decoration: line-through;">${product.originalQuantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center; color: ${differenceColor}; font-weight: bold;">→</td>
                <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold; font-size: 16px; color: ${differenceColor};">${product.confirmedQuantity} <span style="font-size: 12px;">(${differenceText})</span></td>
              </tr>
            `;
          });

          productsHTML += '</tbody></table></div>';
        }
      });

      productsHTML += '<div style="margin: 30px 0; border-top: 2px solid #e0e0e0;"></div>';
    }

    productsHTML += '<h3 style="color: #1a2f2f; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #c4a575; padding-bottom: 8px;">כל המוצרים שאושרו:</h3>';

    Object.keys(categorized).forEach(category => {
      productsHTML += `
        <div style="margin-bottom: 20px;">
          <h4 style="background: #f5f5f5; padding: 10px; border-right: 4px solid #c4a575; margin: 10px 0; font-size: 16px; color: #333;">
            ${category}
          </h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: right;">מוצר</th>
                <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: center; width: 80px;">כמות</th>
                <th style="padding: 10px; border-bottom: 2px solid #e0e0e0; text-align: center; width: 100px;">סטטוס</th>
              </tr>
            </thead>
            <tbody>
      `;

      categorized[category].forEach((product, index) => {
        const bgColor = product.isChanged ? '#fff8e1' : (index % 2 === 0 ? '#ffffff' : '#fafafa');
        const statusText = product.isChanged ? '✏️ שונה' : '✓ ללא שינוי';
        const statusColor = product.isChanged ? '#ff9800' : '#4caf50';

        productsHTML += `
          <tr style="background: ${bgColor};">
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; ${product.isChanged ? 'font-weight: bold;' : ''}">${product.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold;">${product.quantity}</td>
            <td style="padding: 10px; border-bottom: 1px solid #e0e0e0; text-align: center; color: ${statusColor}; font-weight: bold;">${statusText}</td>
          </tr>
        `;
      });

      productsHTML += '</tbody></table></div>';
    });

    productsHTML += '</div>';
  }

  const statusBadge = fullConfirmation
    ? '<div style="display: inline-block; background: #4caf50; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold;">✓ התעודה אושרה במלואה על ידי שלו ללא שינויים</div>'
    : `<div style="display: inline-block; background: #ff9800; color: white; padding: 8px 16px; border-radius: 6px; font-weight: bold;">⚠️ התעודה אושרה על ידי שלו עם ${changedProducts.length} שינויים</div>`;

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl;">
      <div style="max-width: 700px; margin: 0 auto; background: white;">
        <div style="background: linear-gradient(135deg, #1a2f2f 0%, #2d4a4a 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #c4a575; font-size: 36px; margin: 0; font-family: Georgia, serif; font-style: italic;">Zuza</h1>
          <div style="color: white; font-size: 11px; letter-spacing: 3px; margin-top: 5px;">PATISSERIE</div>
          <div style="color: #c4a575; font-size: 20px; margin-top: 15px;">✓ תעודת משלוח אושרה</div>
        </div>

        <div style="padding: 30px;">
          <div style="text-align: center; margin-bottom: 25px;">
            ${statusBadge}
          </div>

          <div style="background: #fff9f0; padding: 25px; border-radius: 8px; border: 2px solid #c4a575; margin-bottom: 25px;">
            <table style="width: 100%; font-size: 15px;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600; width: 150px;">תאריך משלוח:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #1a2f2f;">${deliveryDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600;">מספר תעודה:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #1a2f2f;">${certNumber}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600;">ממלא התעודה:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #1a2f2f;">${fillerName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600;">זמן שליחה:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #1a2f2f;">${submissionTime}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-weight: 600;">זמן אישור:</td>
                <td style="padding: 10px 0; font-weight: bold; color: #4caf50;">${confirmationTime}</td>
              </tr>
            </table>
          </div>

          ${fullConfirmation
            ? '<div style="background: #e8f5e9; padding: 20px; border-radius: 8px; border-right: 4px solid #4caf50; text-align: center; font-size: 16px; color: #2e7d32;"><strong>כל המוצרים הגיעו במלואם ללא שינויים</strong></div>'
            : productsHTML
          }

          <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #666;">מזהה שליחה: <strong>${submissionId}</strong></p>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 13px; color: #999;">זוזה פטיסרי - מערכת ניהול משלוחים</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function buildConfirmationCompleteEmailPlain(deliveryDate, certNumber, fillerName, submissionTime, confirmationTime, fullConfirmation, confirmedProducts, changedProducts, submissionId) {
  let body = `תעודת משלוח אושרה
==================

תאריך משלוח: ${deliveryDate}
מספר תעודה: ${certNumber}
ממלא התעודה: ${fillerName}
זמן שליחה: ${submissionTime}
זמן אישור: ${confirmationTime}

סוג אישור: ${fullConfirmation ? 'אישור מלא - כל המוצרים הגיעו במלואם' : `אישור עם ${changedProducts.length} שינויים`}

`;

  if (!fullConfirmation && changedProducts && changedProducts.length > 0) {
    body += '\n⚠️ שינויים שבוצעו על ידי שלו:\n';
    body += '================================\n';

    const categorized = {};
    changedProducts.forEach(product => {
      const category = product.category;

      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(product);
    });

    Object.keys(categorized).forEach(category => {
      body += `\n${category}:\n`;
      body += '-'.repeat(category.length) + '\n';
      categorized[category].forEach(product => {
        const difference = product.confirmedQuantity - product.originalQuantity;
        const differenceText = difference > 0 ? `+${difference}` : difference.toString();
        body += `  • ${product.name}: ${product.originalQuantity} → ${product.confirmedQuantity} (${differenceText})\n`;
      });
    });

    body += '\n\nכל המוצרים שאושרו:\n';
    body += '==================\n';

    const allCategorized = {};
    confirmedProducts.forEach(product => {
      const productInfo = PRODUCT_ROW_MAP[product.key] || { category: 'אחרים' };
      const category = productInfo.category;

      if (!allCategorized[category]) {
        allCategorized[category] = [];
      }
      allCategorized[category].push(product);
    });

    Object.keys(allCategorized).forEach(category => {
      body += `\n${category}:\n`;
      allCategorized[category].forEach(product => {
        const changedProduct = changedProducts.find(p => p.key === product.key);
        const status = changedProduct ? '(שונה)' : '(ללא שינוי)';
        body += `  • ${product.name}: ${product.quantity} ${status}\n`;
      });
    });
  }

  body += `\n\nמזהה שליחה: ${submissionId}\n`;
  body += '\n---\nזוזה פטיסרי - מערכת ניהול משלוחים';

  return body;
}

// ============================================================================
// PRODUCT MAPPING - WITH HANUKKAH 2025 (10 PRODUCTS, ROWS 95-104)
// ============================================================================

const PRODUCT_ROW_MAP = {
  // HANUKKAH 2025 DONUTS - Rows 80-89 (9 products) - Sheets 10-31 only
  'hanukkah_cashew_gold': { row: 80, name: 'קשיו גולד', category: 'סופגניות חנוכה 2025', price: 19 },
  'hanukkah_chocolate_crunch': { row: 81, name: "שוקולד קראנץ'", category: 'סופגניות חנוכה 2025', price: 19 },
  'hanukkah_cheese_crumbs': { row: 82, name: 'גבינה פירורים', category: 'סופגניות חנוכה 2025', price: 17 },
  'hanukkah_candies': { row: 83, name: 'סוכריות', category: 'סופגניות חנוכה 2025', price: 15 },
  'hanukkah_vanilla_raspberry': { row: 84, name: 'וניל פטל', category: 'סופגניות חנוכה 2025', price: 19 },
  'hanukkah_pistachio': { row: 85, name: 'פיסטוק', category: 'סופגניות חנוכה 2025', price: 19 },
  'hanukkah_mango_passionfruit': { row: 86, name: 'מנגו פסיפלורה', category: 'סופגניות חנוכה 2025', price: 17 },
  'hanukkah_patissier': { row: 87, name: 'פטיסייר קינמון', category: 'סופגניות חנוכה 2025', price: 15 },
  'hanukkah_saint_honore': { row: 89, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 },

  // Sweet pastries - מאפים מתוקים
  'sweet_croissant_butter': { row: 2, name: 'קרואסון חמאה', category: 'מאפים מתוקים', price: 0 },
  'sweet_croissant_chocolate': { row: 3, name: 'קרואסון שוקולד', category: 'מאפים מתוקים', price: 0 },
  'sweet_fruit_pastry': { row: 4, name: 'מאפה פירות', category: 'מאפים מתוקים', price: 0 },
  'sweet_pecan_pastry': { row: 5, name: 'מאפה פקאן', category: 'מאפים מתוקים', price: 0 },
  'sweet_almond_milk_chocolate': { row: 6, name: 'מאפה שקדים שוקולד חלב', category: 'מאפים מתוקים', price: 0 },
  'sweet_cinnamon': { row: 7, name: 'סינבון', category: 'מאפים מתוקים', price: 0 },
  'sweet_pain_suisse': { row: 8, name: 'פאן סוויס', category: 'מאפים מתוקים', price: 0 },
  'sweet_butterfly_pastry': { row: 9, name: 'מאפה פפיון', category: 'מאפים מתוקים', price: 0 },
  'sweet_shti_veerev': { row: 10, name: 'מאפה שתי וערב', category: 'מאפים מתוקים', price: 0 },
  'sweet_rugelach': { row: 11, name: 'רוגלך', category: 'מאפים מתוקים', price: 0 },
  'sweet_chocolate_chips': { row: 12, name: "שוקולד צ'יפס", category: 'מאפים מתוקים', price: 0 },
  'sweet_croissant_pistachio': { row: 13, name: 'קרואסון פיסטוק', category: 'מאפים מתוקים', price: 0 },
  'sweet_croissant_cheese_berry': { row: 14, name: 'קרואסון גבינה פירות יער', category: 'מאפים מתוקים', price: 0 },
  'sweet_croissant_almonds': { row: 15, name: 'קרואסון שקדים', category: 'מאפים מתוקים', price: 0 },
  'sweet_kouign_amann': { row: 16, name: 'קווין אמאן', category: 'מאפים מתוקים', price: 0 },

  // Salty - מלוחים
  'salty_empty_bun': { row: 17, name: 'לחמניה ריקה', category: 'מלוחים', price: 0 },
  'salty_empty_bagel': { row: 18, name: 'בייגל ריק', category: 'מלוחים', price: 0 },
  'salty_empty_poppy_bun': { row: 19, name: 'לחמנית פרג ריקה', category: 'מלוחים', price: 0 },
  'salty_empty_cheese_bourekas': { row: 20, name: 'בורקס גבינה ריק', category: 'מלוחים', price: 0 },
  'salty_rectangle_pastry': { row: 21, name: 'מאפה מלוח (מלבן)', category: 'מלוחים', price: 0 },
  'salty_focaccia_squares': { row: 22, name: "ריבועי פוקאצ'ה", category: 'מלוחים', price: 0 },
  'salty_personal_focaccia': { row: 23, name: "פוקאצ'ה אישית", category: 'מלוחים', price: 0 },
  'salty_quiche_10': { row: 24, name: 'קיש ק.10', category: 'מלוחים', price: 0 },
  'salty_bagelson': { row: 25, name: 'בייגלסון', category: 'מלוחים', price: 0 },
  'salty_brioche_challah': { row: 26, name: 'חלות בריוש', category: 'מלוחים', price: 0 },
  'salty_bread_loaf': { row: 27, name: 'כיכר לחם', category: 'מלוחים', price: 0 },

  // Sandwiches - כריכים
  'sandwiches_beet_sourdough': { row: 28, name: 'מחמצת סלק', category: 'כריכים', price: 0 },
  'sandwiches_eggplant_sourdough': { row: 29, name: 'מחמצת חצילים', category: 'כריכים', price: 0 },
  'sandwiches_brioche_poppy_camembert': { row: 30, name: 'בריוש פרג קממבר', category: 'כריכים', price: 0 },
  'sandwiches_bourekas_cheeses': { row: 31, name: 'כריך בורקס גבינות', category: 'כריכים', price: 0 },
  'sandwiches_croissant_butter': { row: 32, name: 'כריך קרואסון חמאה', category: 'כריכים', price: 0 },
  'sandwiches_bagel': { row: 33, name: 'כריך בייגל', category: 'כריכים', price: 0 },
  'sandwiches_focaccia': { row: 34, name: 'מאפה גבינות סביח', category: 'כריכים', price: 0 },

  // Shelf products - מוצרי מדף
  'shelf_yeast_cake': { row: 35, name: 'עוגת שמרים', category: 'מוצרי מדף', price: 0 },
  'shelf_challah': { row: 36, name: 'חלות', category: 'מוצרי מדף', price: 0 },
  'shelf_thick': { row: 37, name: 'בחושות', category: 'מוצרי מדף', price: 0 },

  // Whole cakes - עוגות שלמות
  'whole_cakes_fudge_mascarpone_strip': { row: 38, name: "פס פאדג' מסקרפונה", category: 'עוגות שלמות', price: 0 },
  'whole_cakes_rusha_hazelnut_strip': { row: 39, name: 'פס רושה אגוזי לוז', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_mango_passionfruit_strip': { row: 40, name: 'פס מנגו פסיפלורה', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_coffee_pecan_strip': { row: 41, name: 'פס קפה פקאן', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_tricolor_20': { row: 42, name: 'טריקולד ק.20', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_pistachio_berry_20': { row: 43, name: 'פיסטוק פירות יער ק.20', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_cheese_crumbs_20': { row: 44, name: 'גבינה פירורים ק.20', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_baked_cheese_20': { row: 45, name: 'גבינה אפויה ק.20', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_rusha_hazelnut_square': { row: 46, name: 'ריבוע רושה אגוזי לוז', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_coffee_pecan_square': { row: 47, name: 'ריבוע קפה פקאן', category: 'עוגות שלמות', price: 0 },
  'whole_cakes_chocolate_fudge': { row: 48, name: "פאדג' שוקולד", category: 'עוגות שלמות', price: 0 },

  // Vitrina desserts - קינוחי ויטרינה
  'vitrina_cashew_dolce': { row: 49, name: "קשיו דולצ'ה", category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_pistachio_berry': { row: 50, name: 'פיסטוק פירות יער', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_pheasant_vanilla_raspberry': { row: 51, name: 'פחזנית וניל פטל', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_sabla_pecan': { row: 52, name: 'סבלה פקאן', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_fruit_tart': { row: 53, name: 'טארט פירות', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_lemon_tart_100': { row: 54, name: 'טארט לימון 100%', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_chocolate_100': { row: 55, name: '100 אחוז שוקולד', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_rusha_hazelnut': { row: 56, name: 'רושה אגוזי לוז', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_paris_brest': { row: 57, name: 'פריז ברסט', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_chocolate_ball': { row: 58, name: 'כדור שוקולד', category: 'קינוחי ויטרינה', price: 0 },
  'vitrina_personal_pheasant_vanilla': { row: 59, name: 'פחזנית וניל אישית', category: 'קינוחי ויטרינה', price: 0 },

  // Cookies - עוגיות
  'cookies_florentine': { row: 60, name: 'פלורנטין', category: 'עוגיות', price: 0 },
  'cookies_coffee_almonds': { row: 61, name: 'קפה שקדים', category: 'עוגיות', price: 0 },
  'cookies_almonds_lemon': { row: 62, name: 'שקדים לימון', category: 'עוגיות', price: 0 },
  'cookies_pecan': { row: 63, name: 'פקאן', category: 'עוגיות', price: 0 },
  'cookies_brownies': { row: 64, name: 'בראוניז', category: 'עוגיות', price: 0 },
  'cookies_butter_hazelnut': { row: 65, name: 'חמאה לוז', category: 'עוגיות', price: 0 },
  'cookies_parmesan': { row: 66, name: 'פרמזן', category: 'עוגיות', price: 0 },
  'cookies_dates': { row: 67, name: 'עוגיות תמרים', category: 'עוגיות', price: 0 },
  'cookies_alfajores': { row: 68, name: 'אלפחורס', category: 'עוגיות', price: 0 },
  'cookies_pistachio_lag_baomer': { row: 69, name: 'פיסטוק לל"ג', category: 'עוגיות', price: 0 },
  'cookies_cocoa_chocolate': { row: 70, name: 'קקאו שוקולד', category: 'עוגיות', price: 0 },

  // Various - מוצרים שונים
  'various_mushroom_pastry': { row: 71, name: 'מאפה פטריות', category: 'מוצרים שונים', price: 0 },
  'various_cheese_berry_pastry': { row: 72, name: 'מאפה גבינה ופירות יער', category: 'מוצרים שונים', price: 0 },
  'various_basque_cheesecake': { row: 73, name: 'עוגת גבינה באסקית', category: 'מוצרים שונים', price: 0 },
  'various_yolk_pasteurized': { row: 74, name: 'חלמון מפוסטר', category: 'מוצרים שונים', price: 0 },
  'various_parmesan_raw': { row: 75, name: 'פרמזן חומר גלם', category: 'מוצרים שונים', price: 0 },
  'various_sweet_cream': { row: 76, name: 'שמנת מתוקה', category: 'מוצרים שונים', price: 0 },
  'various_butter': { row: 77, name: 'חמאה', category: 'מוצרים שונים', price: 0 },
  'various_pistachio_berry_strip': { row: 78, name: 'פס פיסטוק פירות יער', category: 'מוצרים שונים', price: 0 },
  'various_pressburger_poppy': { row: 79, name: 'פרסבורגר פרג', category: 'מוצרים שונים', price: 0 }
};
