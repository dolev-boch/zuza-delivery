/**
 * GOOGLE APPS SCRIPT - ADD HANUKKAH 2025 PRODUCTS TO SHEETS
 *
 * This script adds the Hanukkah 2025 products to rows 80-89
 * in sheets 10-31 inclusive (0-based indexing).
 *
 * INSTRUCTIONS:
 * 1. Open your Google Spreadsheet
 * 2. Go to Extensions > Apps Script
 * 3. Create a new script file and paste this code
 * 4. Run the function: addHanukkahProductsToAllSheets()
 * 5. Grant permissions when prompted
 * 6. Check the execution log for confirmation
 */

// Configuration
const SPREADSHEET_ID = '1U6u_j9lsTwDQ52mnJWJM1eIZ2CqbmqiwBqEQnD21Ia4';
const FIRST_SHEET_TO_UPDATE = 10; // Start from sheet index 10 (0-based, so 11th sheet)
const LAST_SHEET_TO_UPDATE = 31;  // End at sheet index 31 (0-based, so 32nd sheet)
const HANUKKAH_START_ROW = 80;

// Hanukkah 2025 Products - Rows 80-89
const HANUKKAH_PRODUCTS = [
  { row: 80, name: 'קשיו גולד', category: 'סופגניות חנוכה 2025', price: 19 },
  { row: 81, name: "שוקולד קראנץ'", category: 'סופגניות חנוכה 2025', price: 19 },
  { row: 82, name: 'גבינה פירורים', category: 'סופגניות חנוכה 2025', price: 17 },
  { row: 83, name: 'סוכריות', category: 'סופגניות חנוכה 2025', price: 15 },
  { row: 84, name: 'וניל פטל', category: 'סופגניות חנוכה 2025', price: 19 },
  { row: 85, name: 'פיסטוק', category: 'סופגניות חנוכה 2025', price: 19 },
  { row: 86, name: 'מנגו פסיפלורה', category: 'סופגניות חנוכה 2025', price: 17 },
  { row: 87, name: 'פטיסייר קינמון', category: 'סופגניות חנוכה 2025', price: 15 },
  { row: 89, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 }
];

/**
 * Main function to add Hanukkah products to sheets 10-31 inclusive
 */
function addHanukkahProductsToAllSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();

    Logger.log('='.repeat(60));
    Logger.log('ADDING HANUKKAH 2025 PRODUCTS');
    Logger.log('='.repeat(60));
    Logger.log(`Total sheets in spreadsheet: ${sheets.length}`);
    Logger.log(`Will update sheets from index ${FIRST_SHEET_TO_UPDATE} to ${LAST_SHEET_TO_UPDATE} (inclusive)`);
    Logger.log('');

    let updatedCount = 0;
    let skippedCount = 0;

    // Process sheets from FIRST_SHEET_TO_UPDATE to LAST_SHEET_TO_UPDATE (inclusive)
    const endIndex = Math.min(LAST_SHEET_TO_UPDATE, sheets.length - 1);
    for (let i = FIRST_SHEET_TO_UPDATE; i <= endIndex; i++) {
      const sheet = sheets[i];
      const sheetName = sheet.getName();

      Logger.log(`Processing sheet #${i}: "${sheetName}"`);

      try {
        addHanukkahProductsToSheet(sheet);
        updatedCount++;
        Logger.log(`  ✓ Successfully updated sheet "${sheetName}"`);
      } catch (error) {
        Logger.log(`  ✗ Error updating sheet "${sheetName}": ${error.toString()}`);
        skippedCount++;
      }

      Logger.log('');
    }

    Logger.log('='.repeat(60));
    Logger.log('SUMMARY');
    Logger.log('='.repeat(60));
    Logger.log(`Total sheets processed: ${endIndex - FIRST_SHEET_TO_UPDATE + 1}`);
    Logger.log(`Successfully updated: ${updatedCount}`);
    Logger.log(`Skipped/Failed: ${skippedCount}`);
    Logger.log(`Total Hanukkah products added: ${HANUKKAH_PRODUCTS.length * updatedCount}`);
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('✓ DONE! Check the sheets to verify the products were added correctly.');
    Logger.log('');
    Logger.log('NOTE: Row 90 is left blank as separator. אחרים products start at row 91.');

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}

/**
 * Adds Hanukkah products to a single sheet
 */
function addHanukkahProductsToSheet(sheet) {
  HANUKKAH_PRODUCTS.forEach((product, index) => {
    const row = product.row;

    // Check if row already has data to avoid overwriting
    const existingName = sheet.getRange(row, 1).getValue();

    if (existingName && existingName !== '' && existingName !== product.name) {
      Logger.log(`  ⚠ Row ${row} already contains data: "${existingName}" - skipping`);
      return;
    }

    // Set product name (Column A)
    sheet.getRange(row, 1).setValue(product.name);

    // Set category (Column B)
    sheet.getRange(row, 2).setValue(product.category);

    // Clear quantity (Column C) - will be filled by submissions
    sheet.getRange(row, 3).setValue('');

    // Clear notes (Column D)
    sheet.getRange(row, 4).setValue('');

    // Clear last updated (Column E)
    sheet.getRange(row, 5).setValue('');

    Logger.log(`  → Row ${row}: ${product.name}`);
  });

  SpreadsheetApp.flush();
}

/**
 * Add Hanukkah products to a specific sheet by name
 * Usage: addHanukkahProductsToSpecificSheet('01')
 */
function addHanukkahProductsToSpecificSheet(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`ERROR: Sheet "${sheetName}" not found`);
      return;
    }

    Logger.log(`Adding Hanukkah products to sheet: "${sheetName}"`);
    addHanukkahProductsToSheet(sheet);
    Logger.log(`✓ Done!`);

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}

/**
 * Preview which sheets will be updated (dry run)
 */
function previewSheetsToUpdate() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();

    Logger.log('='.repeat(60));
    Logger.log('PREVIEW: Sheets that will be updated');
    Logger.log('='.repeat(60));
    Logger.log(`Total sheets: ${sheets.length}`);
    Logger.log(`Will update from index ${FIRST_SHEET_TO_UPDATE} to ${LAST_SHEET_TO_UPDATE} (inclusive):`);
    Logger.log('');

    const endIndex = Math.min(LAST_SHEET_TO_UPDATE, sheets.length - 1);
    for (let i = FIRST_SHEET_TO_UPDATE; i <= endIndex; i++) {
      const sheet = sheets[i];
      Logger.log(`  ${i}. "${sheet.getName()}"`);
    }

    Logger.log('');
    Logger.log(`Total sheets to update: ${endIndex - FIRST_SHEET_TO_UPDATE + 1}`);
    Logger.log('='.repeat(60));

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}

/**
 * Add products to summary sheet starting at row 81
 * NOTE: This is now handled automatically by the updateSummarySheet() function in Code.gs
 * This function is kept for manual initialization if needed
 */
function addHanukkahProductsToSummarySheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const summarySheet = ss.getSheetByName('סיכום חודש');

    if (!summarySheet) {
      Logger.log('ERROR: Summary sheet "סיכום חודש" not found');
      return;
    }

    Logger.log('Adding Hanukkah products to summary sheet starting at row 81...');

    const SUMMARY_START_ROW = 81;

    // Add products with prices starting at row 81
    HANUKKAH_PRODUCTS.forEach((product, index) => {
      const row = SUMMARY_START_ROW + index;
      summarySheet.getRange(row, 1).setValue(product.name);
      summarySheet.getRange(row, 2).setValue(product.price);
      summarySheet.getRange(row, 3).setValue(0); // Initial quantity 0
    });

    Logger.log(`✓ Added ${HANUKKAH_PRODUCTS.length} Hanukkah products to summary sheet`);
    Logger.log(`  Products in rows ${SUMMARY_START_ROW}-${SUMMARY_START_ROW + HANUKKAH_PRODUCTS.length - 1}`);
    Logger.log('  Row 91+ reserved for אחרים products (auto-updated by Code.gs)');

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}

/**
 * Test function - adds products to current active sheet only
 */
function testAddToCurrentSheet() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    Logger.log(`Testing on active sheet: "${sheet.getName()}"`);
    addHanukkahProductsToSheet(sheet);
    Logger.log('✓ Test completed!');
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}
