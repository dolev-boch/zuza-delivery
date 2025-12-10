/**
 * GOOGLE APPS SCRIPT - RENAME PRODUCT IN ALL SHEETS
 *
 * This script renames "כריך פוקאצ'ה" to "מאפה גבינות סביח"
 * in row 34 across all delivery sheets.
 *
 * INSTRUCTIONS:
 * 1. Open your Google Spreadsheet
 * 2. Go to Extensions → Apps Script
 * 3. Create a new file and paste this code
 * 4. Run the function: renameProductInAllSheets()
 * 5. Check the execution log for confirmation
 *
 * NOTE: This only needs to be run ONCE to update existing sheets.
 * After deployment, new deliveries will automatically use the new name.
 */

const SPREADSHEET_ID = '1U6u_j9lsTwDQ52mnJWJM1eIZ2CqbmqiwBqEQnD21Ia4';
const OLD_PRODUCT_NAME = 'כריך פוקאצ\'ה';
const NEW_PRODUCT_NAME = 'מאפה גבינות סביח';
const PRODUCT_ROW = 34;
const PRODUCT_NAME_COLUMN = 1; // Column A

function renameProductInAllSheets() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();

    Logger.log('='.repeat(60));
    Logger.log('RENAMING PRODUCT IN ALL SHEETS');
    Logger.log('='.repeat(60));
    Logger.log(`Old name: "${OLD_PRODUCT_NAME}"`);
    Logger.log(`New name: "${NEW_PRODUCT_NAME}"`);
    Logger.log(`Target row: ${PRODUCT_ROW}`);
    Logger.log(`Total sheets to check: ${sheets.length}`);
    Logger.log('');

    let updatedCount = 0;
    let skippedCount = 0;

    sheets.forEach((sheet, index) => {
      const sheetName = sheet.getName();

      // Skip summary sheet
      if (sheetName === 'סיכום חודש') {
        Logger.log(`Skipping summary sheet: "${sheetName}"`);
        return;
      }

      // Get the current value in row 34, column A
      const currentValue = sheet.getRange(PRODUCT_ROW, PRODUCT_NAME_COLUMN).getValue();

      // Check if it matches the old product name
      if (currentValue === OLD_PRODUCT_NAME) {
        // Update to new name
        sheet.getRange(PRODUCT_ROW, PRODUCT_NAME_COLUMN).setValue(NEW_PRODUCT_NAME);
        updatedCount++;
        Logger.log(`✓ Updated sheet "${sheetName}" (index ${index})`);
      } else {
        skippedCount++;
        if (currentValue) {
          Logger.log(`- Skipped "${sheetName}" - has "${currentValue}"`);
        }
      }
    });

    Logger.log('');
    Logger.log('='.repeat(60));
    Logger.log('SUMMARY');
    Logger.log('='.repeat(60));
    Logger.log(`Total sheets checked: ${sheets.length}`);
    Logger.log(`Sheets updated: ${updatedCount}`);
    Logger.log(`Sheets skipped: ${skippedCount}`);
    Logger.log('='.repeat(60));
    Logger.log('');
    Logger.log('✓ DONE! Product name has been updated in all relevant sheets.');

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}

/**
 * Preview which sheets will be updated (dry run)
 */
function previewRename() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();

    Logger.log('='.repeat(60));
    Logger.log('PREVIEW: Sheets that will be updated');
    Logger.log('='.repeat(60));

    let matchCount = 0;

    sheets.forEach((sheet, index) => {
      const sheetName = sheet.getName();

      if (sheetName === 'סיכום חודש') {
        return;
      }

      const currentValue = sheet.getRange(PRODUCT_ROW, PRODUCT_NAME_COLUMN).getValue();

      if (currentValue === OLD_PRODUCT_NAME) {
        matchCount++;
        Logger.log(`${matchCount}. "${sheetName}" (index ${index}) - will be updated`);
      }
    });

    Logger.log('');
    Logger.log(`Total sheets that will be updated: ${matchCount}`);
    Logger.log('='.repeat(60));

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    throw error;
  }
}
