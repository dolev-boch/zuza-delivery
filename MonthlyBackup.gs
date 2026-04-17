// ============================================================================
// ZUZA PATISSERIE - MONTHLY BACKUP SYSTEM (SAFE TEST VERSION)
// Google Apps Script - MonthlyBackups.js
// THIS VERSION: Tests backup & permissions WITHOUT resetting data
// USE THIS FOR TESTING - Switch to production mode after successful test
// ============================================================================

// ⚠️ SAFETY MODE: Set to false to enable production mode with data reset
// ============================================================================
// ZUZA PATISSERIE - MONTHLY BACKUP SYSTEM (SAFE TEST VERSION)
// Google Apps Script - MonthlyBackups.js
// THIS VERSION: Tests backup & permissions WITHOUT resetting data
// USE THIS FOR TESTING - Switch to production mode after successful test
// ============================================================================

// ⚠️ SAFETY MODE: Set to false to enable production mode with data reset
const SAFE_TEST_MODE = false;

// Use different constant names to avoid conflicts with קוד.js
const BACKUP_SPREADSHEET_ID = '1U6u_j9lsTwDQ52mnJWJM1eIZ2CqbmqiwBqEQnD21Ia4';
const BACKUP_FOLDER_ID = '1sGKF7wufuaYlJg7ZMfzxIdqzSr8SPYkV';

// Product mapping (needed for reset functionality in production mode)
// UPDATED: Matches Code.gs structure - Added 3 new products, removed Hanukkah products
const BACKUP_PRODUCT_ROW_MAP = {
  // Sweet pastries - מאפים מתוקים (rows 2-19)
  sweet_croissant_butter: { row: 2, name: 'קרואסון חמאה', category: 'מאפים מתוקים' },
  sweet_croissant_chocolate: { row: 3, name: 'קרואסון שוקולד', category: 'מאפים מתוקים' },
  sweet_fruit_pastry: { row: 4, name: 'מאפה פירות', category: 'מאפים מתוקים' },
  sweet_pecan_pastry: { row: 5, name: 'מאפה פקאן', category: 'מאפים מתוקים' },
  sweet_almond_milk_chocolate: { row: 6, name: 'מאפה שקדים שוקולד חלב', category: 'מאפים מתוקים' },
  sweet_cinnamon: { row: 7, name: 'סינבון', category: 'מאפים מתוקים' },
  sweet_pain_suisse: { row: 8, name: 'פאן סוויס', category: 'מאפים מתוקים' },
  sweet_butterfly_pastry: { row: 9, name: 'מאפה פפיון', category: 'מאפים מתוקים' },
  sweet_shti_veerev: { row: 10, name: 'מאפה שתי וערב', category: 'מאפים מתוקים' },
  sweet_rugelach: { row: 11, name: 'רוגלך', category: 'מאפים מתוקים' },
  sweet_chocolate_chips: { row: 12, name: "שוקולד צ'יפס", category: 'מאפים מתוקים' },
  sweet_croissant_pistachio: { row: 13, name: 'קרואסון פיסטוק', category: 'מאפים מתוקים' },
  sweet_croissant_cheese_berry: { row: 14, name: 'קרואסון גבינה פירות יער', category: 'מאפים מתוקים' },
  sweet_croissant_almonds: { row: 15, name: 'קרואסון שקדים', category: 'מאפים מתוקים' },
  sweet_kouign_amann: { row: 16, name: 'קווין אמאן', category: 'מאפים מתוקים' },
  sweet_krapfen: { row: 17, name: 'קראפין', category: 'מאפים מתוקים' },
  sweet_brioche_sugar: { row: 18, name: 'בריוש סוכרה', category: 'מאפים מתוקים' },
  sweet_brownies_hazelnut: { row: 19, name: 'מאפה בראוניז לוז', category: 'מאפים מתוקים' },

  // Salty - מלוחים (rows 20-34)
  salty_empty_bun: { row: 20, name: 'לחמניה ריקה', category: 'מלוחים' },
  salty_empty_bagel: { row: 21, name: 'בייגל ריק', category: 'מלוחים' },
  salty_empty_poppy_bun: { row: 22, name: 'לחמנית פרג ריקה', category: 'מלוחים' },
  salty_empty_cheese_bourekas: { row: 23, name: 'בורקס גבינה ריק', category: 'מלוחים' },
  salty_rectangle_pastry: { row: 24, name: 'מאפה מלוח (מלבן)', category: 'מלוחים' },
  salty_focaccia_squares: { row: 25, name: "ריבועי פוקאצ'ה", category: 'מלוחים' },
  salty_personal_focaccia: { row: 26, name: "פוקאצ'ה אישית", category: 'מלוחים' },
  salty_quiche_10: { row: 27, name: 'קיש ק.10', category: 'מלוחים' },
  salty_bagelson: { row: 28, name: 'בייגלסון', category: 'מלוחים' },
  salty_brioche_challah: { row: 29, name: 'חלות בריוש', category: 'מלוחים' },
  salty_bread_loaf: { row: 30, name: 'כיכר לחם', category: 'מלוחים' },
  salty_cheese_saviach: { row: 31, name: 'מאפה גבינות וסביח', category: 'מלוחים' },
  salty_cheese_spinach: { row: 32, name: 'מאפה גבינה ותרד', category: 'מלוחים' },
  salty_poppy_bun: { row: 33, name: 'לחמניית פרג', category: 'מלוחים' },
  salty_pretzel: { row: 34, name: 'פרעצל', category: 'מלוחים' },

  // Sandwiches - כריכים (rows 35-42)
  sandwiches_beet_sourdough: { row: 35, name: 'מחמצת סלק', category: 'כריכים' },
  sandwiches_eggplant_sourdough: { row: 36, name: 'מחמצת חצילים', category: 'כריכים' },
  sandwiches_brioche_poppy_camembert: { row: 37, name: 'בריוש פרג קממבר', category: 'כריכים' },
  sandwiches_bourekas_cheeses: { row: 38, name: 'כריך בורקס גבינות', category: 'כריכים' },
  sandwiches_croissant_butter: { row: 39, name: 'כריך קרואסון חמאה', category: 'כריכים' },
  sandwiches_bagel: { row: 40, name: 'כריך בייגל', category: 'כריכים' },
  sandwiches_focaccia: { row: 41, name: "כריך פוקאצ'ה", category: 'כריכים' },
  sandwiches_scrambled_bun: { row: 42, name: 'לחמניה מקושקשת', category: 'כריכים' },

  // Shelf products - מוצרי מדף (rows 43-45)
  shelf_yeast_cake: { row: 43, name: 'עוגת שמרים', category: 'מוצרי מדף' },
  shelf_challah: { row: 44, name: 'חלות', category: 'מוצרי מדף' },
  shelf_thick: { row: 45, name: 'בחושות', category: 'מוצרי מדף' },

  // Whole cakes - עוגות שלמות (rows 46-56)
  whole_cakes_fudge_mascarpone_strip: { row: 46, name: "פס פאדג' מסקרפונה", category: 'עוגות שלמות' },
  whole_cakes_rusha_hazelnut_strip: { row: 47, name: 'פס רושה אגוזי לוז', category: 'עוגות שלמות' },
  whole_cakes_mango_passionfruit_strip: { row: 48, name: 'פס מנגו פסיפלורה', category: 'עוגות שלמות' },
  whole_cakes_coffee_pecan_strip: { row: 49, name: 'פס קפה פקאן', category: 'עוגות שלמות' },
  whole_cakes_tricolor_20: { row: 50, name: 'טריקולד ק.20', category: 'עוגות שלמות' },
  whole_cakes_pistachio_berry_20: { row: 51, name: 'פיסטוק פירות יער ק.20', category: 'עוגות שלמות' },
  whole_cakes_cheese_crumbs_20: { row: 52, name: 'גבינה פירורים ק.20', category: 'עוגות שלמות' },
  whole_cakes_baked_cheese_20: { row: 53, name: 'גבינה אפויה ק.20', category: 'עוגות שלמות' },
  whole_cakes_rusha_hazelnut_square: { row: 54, name: 'ריבוע רושה אגוזי לוז', category: 'עוגות שלמות' },
  whole_cakes_coffee_pecan_square: { row: 55, name: 'ריבוע קפה פקאן', category: 'עוגות שלמות' },
  whole_cakes_chocolate_fudge: { row: 56, name: "פאדג' שוקולד", category: 'עוגות שלמות' },

  // Vitrina desserts - קינוחי ויטרינה (rows 57-68)
  vitrina_cashew_dolce: { row: 57, name: "קשיו דולצ'ה", category: 'קינוחי ויטרינה' },
  vitrina_pistachio_berry: { row: 58, name: 'פיסטוק פירות יער', category: 'קינוחי ויטרינה' },
  vitrina_pheasant_vanilla_raspberry: { row: 59, name: 'פחזנית וניל פטל', category: 'קינוחי ויטרינה' },
  vitrina_sabla_pecan: { row: 60, name: 'סבלה פקאן', category: 'קינוחי ויטרינה' },
  vitrina_fruit_tart: { row: 61, name: 'טארט פירות', category: 'קינוחי ויטרינה' },
  vitrina_lemon_tart_100: { row: 62, name: 'טארט לימון 100%', category: 'קינוחי ויטרינה' },
  vitrina_chocolate_100: { row: 63, name: '100 אחוז שוקולד', category: 'קינוחי ויטרינה' },
  vitrina_rusha_hazelnut: { row: 64, name: 'רושה אגוזי לוז', category: 'קינוחי ויטרינה' },
  vitrina_paris_brest: { row: 65, name: 'פריז ברסט', category: 'קינוחי ויטרינה' },
  vitrina_chocolate_ball: { row: 66, name: 'כדור שוקולד', category: 'קינוחי ויטרינה' },
  vitrina_personal_pheasant_vanilla: { row: 67, name: 'פחזנית וניל אישית', category: 'קינוחי ויטרינה' },
  vitrina_chocolate_fudge: { row: 68, name: "פאדג' שוקולד", category: 'קינוחי ויטרינה' },

  // Cookies - עוגיות (rows 69-79)
  cookies_florentine: { row: 69, name: 'פלורנטין', category: 'עוגיות' },
  cookies_coffee_almonds: { row: 70, name: 'קפה שקדים', category: 'עוגיות' },
  cookies_almonds_lemon: { row: 71, name: 'שקדים לימון', category: 'עוגיות' },
  cookies_pecan: { row: 72, name: 'פקאן', category: 'עוגיות' },
  cookies_brownies: { row: 73, name: 'בראוניז', category: 'עוגיות' },
  cookies_butter_hazelnut: { row: 74, name: 'חמאה לוז', category: 'עוגיות' },
  cookies_parmesan: { row: 75, name: 'פרמזן', category: 'עוגיות' },
  cookies_dates: { row: 76, name: 'עוגיות תמרים', category: 'עוגיות' },
  cookies_alfajores: { row: 77, name: 'אלפחורס', category: 'עוגיות' },
  cookies_pistachio_lag_baomer: { row: 78, name: 'פיסטוק לל"ג', category: 'עוגיות' },
  cookies_cocoa_chocolate: { row: 79, name: 'קקאו שוקולד', category: 'עוגיות' },

  // Various products - מוצרים שונים (rows 80-88)
  various_mushroom_pastry: { row: 80, name: 'מאפה פטריות', category: 'מוצרים שונים' },
  various_cheese_berry_pastry: { row: 81, name: 'מאפה גבינה ופירות יער', category: 'מוצרים שונים' },
  various_basque_cheesecake: { row: 82, name: 'עוגת גבינה באסקית', category: 'מוצרים שונים' },
  various_yolk_pasteurized: { row: 83, name: 'חלמון מפוסטר', category: 'מוצרים שונים' },
  various_parmesan_raw: { row: 84, name: 'פרמזן חומר גלם', category: 'מוצרים שונים' },
  various_sweet_cream: { row: 85, name: 'שמנת מתוקה', category: 'מוצרים שונים' },
  various_butter: { row: 86, name: 'חמאה', category: 'מוצרים שונים' },
  various_pistachio_berry_strip: { row: 87, name: 'פס פיסטוק פירות יער', category: 'מוצרים שונים' },
  various_pressburger_poppy: { row: 88, name: 'פרסבורגר פרג', category: 'מוצרים שונים' },
};

const BACKUP_COLUMNS = {
  PRODUCT_NAME: 1,
  CATEGORY: 2,
  QUANTITY: 3,
  NOTES: 4,
  LAST_UPDATED: 5,
  DATE: 8,
  CERT_NUMBER: 9,
  FILLER_NAME: 10,
  SUBMISSION_ID: 11,
  CONFIRMATION_STATUS: 12,
  CONFIRMATION_TIME: 13,
};

const BACKUP_CUSTOM_PRODUCTS_START_ROW = 89; // Row 88 is last regular product, 89+ for אחרים

// NOTE: onOpen() is defined in Code.gs (merged menu). Do not redefine here.

// ============================================================================
// MAIN FUNCTION - Called by trigger (PRODUCTION) or manually (TEST)
// ============================================================================

function backupAndResetMonthly() {
  const lock = LockService.getScriptLock();

  try {
    Logger.log('='.repeat(80));
    Logger.log('STARTING MONTHLY BACKUP PROCESS');
    Logger.log(
      'MODE: ' +
        (SAFE_TEST_MODE
          ? '🧪 TEST MODE - NO DATA WILL BE DELETED'
          : '⚠️ PRODUCTION MODE - DATA WILL BE RESET')
    );
    Logger.log('='.repeat(80));

    if (!lock.tryLock(10000)) {
      throw new Error('Could not acquire lock - another process is running');
    }

    // STEP 1: Create backup
    Logger.log('\n📦 STEP 1: Creating backup...');
    const backupResult = createMonthlyBackup();

    if (!backupResult.success) {
      throw new Error('Backup failed: ' + backupResult.error);
    }

    Logger.log('✅ Backup created successfully: ' + backupResult.fileName);
    Logger.log('📁 Backup URL: ' + backupResult.url);

    // STEP 2: Wait to ensure backup is complete
    Logger.log('\n⏳ Waiting 2 seconds to ensure backup is complete...');
    Utilities.sleep(2000);

    // STEP 3: Reset sheets (only in production mode)
    if (SAFE_TEST_MODE) {
      Logger.log('\n🧪 TEST MODE: Skipping data reset (data is safe)');
      Logger.log('✅ Test completed successfully - no data was modified');

      // Send test notification
      sendTestNotification(backupResult.fileName, backupResult.url);

      return {
        success: true,
        testMode: true,
        backup: backupResult,
        reset: { skipped: true, message: 'Data reset skipped in test mode' },
      };
    } else {
      Logger.log('\n🗑️ STEP 2: PRODUCTION MODE - Resetting all sheets...');
      const resetResult = resetAllSheetsForBackup();

      if (!resetResult.success) {
        throw new Error('Reset failed: ' + resetResult.error);
      }

      Logger.log('✅ All sheets reset successfully: ' + resetResult.sheetsReset + ' sheets');

      // Send production notification
      sendBackupNotification(backupResult.fileName, backupResult.url, resetResult.sheetsReset);

      return {
        success: true,
        testMode: false,
        backup: backupResult,
        reset: resetResult,
      };
    }
  } catch (error) {
    Logger.log('\n❌ ERROR in backupAndResetMonthly: ' + error.toString());
    sendErrorNotification(error.toString());

    return {
      success: false,
      error: error.toString(),
    };
  } finally {
    lock.releaseLock();
    Logger.log('\n' + '='.repeat(80));
    Logger.log('PROCESS COMPLETED');
    Logger.log('='.repeat(80));
  }
}

// ============================================================================
// BACKUP FUNCTION - Always creates backup (safe operation)
// ============================================================================

function createMonthlyBackup() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const today = new Date();

    // Get previous month
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // Format: "SheetName_11-2025" for November backup
    const month = Utilities.formatDate(previousMonth, Session.getScriptTimeZone(), 'MM');
    const year = Utilities.formatDate(previousMonth, Session.getScriptTimeZone(), 'yyyy');
    const monthName = Utilities.formatDate(previousMonth, 'he-IL', 'MMMM');
    let fileName = spreadsheet.getName() + '_' + month + '-' + year;

    // Add TEST prefix if in test mode
    if (SAFE_TEST_MODE) {
      fileName = 'TEST_' + fileName;
    }

    Logger.log('Creating backup: ' + fileName);

    // Get the file and folder
    const file = DriveApp.getFileById(SPREADSHEET_ID);
    const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);

    // Check if backup already exists
    const existingFiles = folder.getFilesByName(fileName);
    if (existingFiles.hasNext()) {
      Logger.log('⚠️ Backup already exists, creating with timestamp...');
      const timestamp = Utilities.formatDate(
        today,
        Session.getScriptTimeZone(),
        'dd-MM-yyyy_HH-mm'
      );
      fileName = fileName + '_' + timestamp;
    }

    // Create the backup copy
    Logger.log('Copying spreadsheet to backup folder...');
    const copiedFile = file.makeCopy(fileName, folder);

    Logger.log('✅ Backup created successfully: ' + copiedFile.getName());
    Logger.log('File ID: ' + copiedFile.getId());

    return {
      success: true,
      fileName: fileName,
      url: copiedFile.getUrl(),
      fileId: copiedFile.getId(),
      month: monthName,
      year: year,
    };
  } catch (error) {
    Logger.log('❌ ERROR in createMonthlyBackup: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
    };
  }
}

// ============================================================================
// RESET FUNCTION - Only runs in production mode
// ============================================================================

function resetAllSheetsForBackup() {
  // Safety check - should never be called in test mode
  if (SAFE_TEST_MODE) {
    Logger.log('🛡️ SAFETY CHECK: Reset blocked in test mode');
    return {
      success: false,
      error: 'Reset blocked - test mode is enabled',
    };
  }

  try {
    const ss = SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID);
    let sheetsReset = 0;

    Logger.log('Starting to reset 31 sheets...');

    for (let day = 1; day <= 31; day++) {
      try {
        // Format day as "01", "02", ..., "09", "10", ..., "31"
        const sheetName = day < 10 ? '0' + day : day.toString();
        let sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
          Logger.log('Creating new sheet for day ' + sheetName);
          sheet = ss.insertSheet(sheetName);
        }

        setupSheetStructureForBackup(sheet);
        sheetsReset++;

        // Flush every 5 sheets to prevent timeout
        if (day % 5 === 0) {
          SpreadsheetApp.flush();
          Logger.log('Progress: ' + day + '/31 sheets reset');
        }
      } catch (error) {
        Logger.log('⚠️ Error resetting sheet ' + day + ': ' + error.message);
      }
    }

    SpreadsheetApp.flush();
    Logger.log('✅ Completed: ' + sheetsReset + ' sheets reset successfully');

    return {
      success: true,
      sheetsReset: sheetsReset,
    };
  } catch (error) {
    Logger.log('❌ ERROR in resetAllSheetsForBackup: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
    };
  }
}

// ============================================================================
// SETUP SHEET STRUCTURE
// ============================================================================

function setupSheetStructureForBackup(sheet) {
  // Clear ALL content and formats to ensure clean reset
  sheet.clear();

  // Set RTL (right-to-left) direction for Hebrew
  sheet.setRightToLeft(true);

  const headers = [
    'שם מוצר',
    'קטגוריה',
    'כמות',
    'הערות',
    'עדכון אחרון',
    '',
    '',
    'תאריך משלוח',
    'מספר תעודה',
    'ממלא התעודה',
    'מזהה שליחה',
    'סטטוס אישור',
    'זמן אישור',
  ];

  // Set headers
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet
    .getRange(1, 1, 1, headers.length)
    .setBackground('#1a2f2f')
    .setFontColor('#c4a575')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  // Format columns as text to prevent date auto-conversion
  sheet.getRange('E:E').setNumberFormat('@');
  sheet.getRange('M:M').setNumberFormat('@');

  // Set up product rows with new structure
  Object.entries(BACKUP_PRODUCT_ROW_MAP)
    .sort((a, b) => a[1].row - b[1].row)
    .forEach(([key, info]) => {
      const rowData = [info.name, info.category, 0, '', ''];
      sheet.getRange(info.row, 1, 1, 5).setValues([rowData]);
    });

  sheet.setFrozenRows(1);
}

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

function sendTestNotification(fileName, backupUrl) {
  try {
    const today = new Date();
    const formattedDate = Utilities.formatDate(today, 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');

    const subject = '🧪 בדיקת גיבוי הצליחה - זוזה פטיסרי';

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, #1976d2 0%, #2196f3 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; font-size: 36px; margin: 0; font-family: Georgia, serif; font-style: italic;">Zuza</h1>
            <div style="color: white; font-size: 11px; letter-spacing: 3px; margin-top: 5px;">PATISSERIE</div>
            <div style="color: white; font-size: 20px; margin-top: 15px;">🧪 בדיקת גיבוי הצליחה</div>
          </div>
          
          <div style="padding: 30px;">
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border-right: 4px solid #2196f3; margin-bottom: 25px;">
              <h2 style="margin: 0 0 10px 0; color: #1565c0; font-size: 18px;">✓ הבדיקה הצליחה!</h2>
              <p style="margin: 0; color: #666;">המערכת יכולה לגבות נתונים בהצלחה. אף נתון לא נמחק בבדיקה זו.</p>
            </div>
            
            <div style="background: #fff9f0; padding: 20px; border-radius: 8px; border: 2px solid #c4a575; margin-bottom: 20px;">
              <h3 style="margin: 0 0 15px 0; color: #1a2f2f;">פרטי הבדיקה:</h3>
              <table style="width: 100%; font-size: 15px;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 600;">שם קובץ הבדיקה:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${fileName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 600;">תאריך בדיקה:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 600;">מצב:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #2196f3;">מצב בדיקה - ללא איפוס נתונים</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="${backupUrl}" style="display: inline-block; background: #2196f3; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                📁 פתח את קובץ הבדיקה
              </a>
            </div>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 6px; margin-top: 25px; border-right: 4px solid #ff9800;">
              <h3 style="margin: 0 0 10px 0; color: #e65100; font-size: 16px;">⚙️ הפעלת מצב ייצור:</h3>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">כדי להפעיל את מצב הייצור שיאפס נתונים:</p>
              <ol style="margin: 10px 0 0 0; padding-right: 20px; font-size: 14px; color: #666;">
                <li>פתח את סקריפט MonthlyBackups.js</li>
                <li>שנה את השורה: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">const SAFE_TEST_MODE = true;</code></li>
                <li>ל: <code style="background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">const SAFE_TEST_MODE = false;</code></li>
                <li>שמור את הקובץ</li>
              </ol>
            </div>
            
            <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin-top: 20px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #2e7d32;">✅ כל ההרשאות פועלות כראוי והמערכת מוכנה לשימוש</p>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 12px; color: #999;">זוזה פטיסרי - מערכת ניהול משלוחים</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const plainBody = `בדיקת גיבוי הצליחה - זוזה פטיסרי

✓ הבדיקה הצליחה!
המערכת יכולה לגבות נתונים בהצלחה. אף נתון לא נמחק בבדיקה זו.

פרטי הבדיקה:
- שם קובץ: ${fileName}
- תאריך: ${formattedDate}
- מצב: בדיקה בלבד (ללא איפוס נתונים)

קישור לקובץ הבדיקה:
${backupUrl}

הפעלת מצב ייצור:
כדי להפעיל מצב ייצור שיאפס נתונים:
1. פתח MonthlyBackups.js
2. שנה: const SAFE_TEST_MODE = true;
3. ל: const SAFE_TEST_MODE = false;
4. שמור

---
זוזה פטיסרי - מערכת ניהול משלוחים`;

    GmailApp.sendEmail('zuzatiberias@gmail.com', subject, plainBody, {
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים',
    });

    Logger.log('✅ Test notification email sent successfully');
  } catch (error) {
    Logger.log('⚠️ Failed to send test notification email: ' + error.toString());
  }
}

function sendBackupNotification(fileName, backupUrl, sheetsReset) {
  try {
    const today = new Date();
    const formattedDate = Utilities.formatDate(today, 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');

    const subject = '✅ גיבוי חודשי הושלם בהצלחה - זוזה פטיסרי';

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, #1a2f2f 0%, #2d4a4a 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #c4a575; font-size: 36px; margin: 0; font-family: Georgia, serif; font-style: italic;">Zuza</h1>
            <div style="color: white; font-size: 11px; letter-spacing: 3px; margin-top: 5px;">PATISSERIE</div>
            <div style="color: #c4a575; font-size: 20px; margin-top: 15px;">✅ גיבוי חודשי הושלם</div>
          </div>
          
          <div style="padding: 30px;">
            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; border-right: 4px solid #4caf50; margin-bottom: 25px;">
              <h2 style="margin: 0 0 10px 0; color: #2e7d32; font-size: 18px;">✓ הגיבוי הושלם בהצלחה</h2>
              <p style="margin: 0; color: #666;">כל הנתונים מהחודש הקודם גובו בהצלחה ו-${sheetsReset} גיליונות אופסו לחודש החדש</p>
            </div>
            
            <div style="background: #fff9f0; padding: 20px; border-radius: 8px; border: 2px solid #c4a575; margin-bottom: 20px;">
              <table style="width: 100%; font-size: 15px;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 600;">שם קובץ הגיבוי:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${fileName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 600;">תאריך יצירה:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #1a2f2f;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: 600;">גיליונות שאופסו:</td>
                  <td style="padding: 8px 0; font-weight: bold; color: #4caf50;">${sheetsReset} מתוך 31</td>
                </tr>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
              <a href="${backupUrl}" style="display: inline-block; background: #4caf50; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
                📁 פתח את קובץ הגיבוי
              </a>
            </div>
            
            <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin-top: 25px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666;">הגיליונות אופסו וממתינים לנתונים חדשים של החודש הנוכחי</p>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 12px; color: #999;">זוזה פטיסרי - מערכת ניהול משלוחים</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const plainBody = `גיבוי חודשי הושלם בהצלחה - זוזה פטיסרי

שם קובץ הגיבוי: ${fileName}
תאריך יצירה: ${formattedDate}
גיליונות שאופסו: ${sheetsReset} מתוך 31

לפתיחת קובץ הגיבוי:
${backupUrl}

הגיליונות אופסו וממתינים לנתונים חדשים של החודש הנוכחי.

---
זוזה פטיסרי - מערכת ניהול משלוחים`;

    GmailApp.sendEmail('zuzatiberias@gmail.com', subject, plainBody, {
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים',
    });

    Logger.log('✅ Notification email sent successfully');
  } catch (error) {
    Logger.log('⚠️ Failed to send notification email: ' + error.toString());
  }
}

function sendErrorNotification(errorMessage) {
  try {
    const today = new Date();
    const formattedDate = Utilities.formatDate(today, 'Asia/Jerusalem', 'dd/MM/yyyy HH:mm');

    const subject = '❌ שגיאה בגיבוי חודשי - זוזה פטיסרי';

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; direction: rtl;">
        <div style="max-width: 600px; margin: 0 auto; background: white;">
          <div style="background: linear-gradient(135deg, #c62828 0%, #d32f2f 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: white; font-size: 36px; margin: 0; font-family: Georgia, serif; font-style: italic;">Zuza</h1>
            <div style="color: white; font-size: 11px; letter-spacing: 3px; margin-top: 5px;">PATISSERIE</div>
            <div style="color: white; font-size: 20px; margin-top: 15px;">❌ שגיאה בגיבוי חודשי</div>
          </div>
          
          <div style="padding: 30px;">
            <div style="background: #ffebee; padding: 20px; border-radius: 8px; border-right: 4px solid #c62828; margin-bottom: 25px;">
              <h2 style="margin: 0 0 10px 0; color: #c62828; font-size: 18px;">⚠️ אירעה שגיאה בתהליך הגיבוי</h2>
              <p style="margin: 0; color: #666;">יש לבצע את הגיבוי באופן ידני</p>
            </div>
            
            <div style="background: #fff9f0; padding: 20px; border-radius: 8px; border: 2px solid #c4a575; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #666;">פרטי השגיאה:</p>
              <p style="margin: 0; color: #333; font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-word;">${errorMessage}</p>
            </div>
            
            <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-top: 25px;">
              <p style="margin: 0; font-size: 14px; color: #856404;"><strong>המלצה:</strong> פנה למפתח המערכת או בצע את הגיבוי באופן ידני דרך התפריט</p>
            </div>
            
            <div style="margin-top: 20px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #666;">זמן השגיאה: ${formattedDate}</p>
            </div>
          </div>
          
          <div style="background: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 12px; color: #999;">זוזה פטיסרי - מערכת ניהול משלוחים</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const plainBody = `שגיאה בגיבוי חודשי - זוזה פטיסרי

אירעה שגיאה בתהליך הגיבוי האוטומטי.
יש לבצע את הגיבוי באופן ידני.

פרטי השגיאה:
${errorMessage}

זמן השגיאה: ${formattedDate}

---
זוזה פטיסרי - מערכת ניהול משלוחים`;

    GmailApp.sendEmail('zuzatiberias@gmail.com', subject, plainBody, {
      htmlBody: htmlBody,
      name: 'זוזה פטיסרי - מערכת משלוחים',
    });

    Logger.log('Error notification email sent');
  } catch (error) {
    Logger.log('Failed to send error notification: ' + error.toString());
  }
}

// ============================================================================
// UPDATE SHEET STRUCTURE - Apply new product structure to existing sheets
// ============================================================================

/**
 * Updates the product structure for sheets 1-31 to match the new BACKUP_PRODUCT_ROW_MAP
 * This function:
 * 1. Adds new products (קראפין, מאפה גבינות וסביח, מאפה גבינה ותרד)
 * 2. Removes old products (כריך פוקאצ'ה)
 * 3. Renumbers all products to match the new structure
 * 4. Preserves existing quantity data
 *
 * USER MUST MANUALLY ADD QUANTITY TOTALS AFTER RUNNING THIS FUNCTION
 */
function updateAllSheetsStructure() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    '⚙️ עדכון מבנה גיליונות',
    'פעולה זו תעדכן את מבנה המוצרים בכל 31 הגיליונות:\n\n' +
    '✅ תוסיף מוצרים חדשים:\n' +
    '   • קראפין (שורה 17)\n' +
    '   • מאפה גבינות וסביח (שורה 29)\n' +
    '   • מאפה גבינה ותרד (שורה 30)\n\n' +
    '✅ תסיר מוצרים ישנים:\n' +
    '   • כריך פוקאצ\'ה\n\n' +
    '✅ תעדכן את מספור כל השורות\n\n' +
    '⚠️ הכמויות הקיימות יישמרו\n' +
    '⚠️ יש להוסיף סכומים ידנית לאחר מכן\n\n' +
    'האם להמשיך?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('הפעולה בוטלה');
    return;
  }

  ui.alert('העדכון מתבצע...\n\nזה עשוי לקחת מספר שניות.\nאנא המתן.');

  try {
    const ss = SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID);
    let sheetsUpdated = 0;
    const errors = [];

    Logger.log('Starting to update sheet structures...');

    for (let day = 1; day <= 31; day++) {
      try {
        // Format day as "01", "02", ..., "09", "10", ..., "31"
        const sheetName = day < 10 ? '0' + day : day.toString();
        const sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
          Logger.log(`Sheet ${sheetName} does not exist, skipping`);
          continue;
        }

        Logger.log(`Updating sheet ${sheetName}...`);
        updateSheetStructure(sheet);
        sheetsUpdated++;

        // Flush every 5 sheets to prevent timeout
        if (day % 5 === 0) {
          SpreadsheetApp.flush();
          Logger.log(`Progress: ${day}/31 sheets updated`);
        }
      } catch (error) {
        const sheetName = day < 10 ? '0' + day : day.toString();
        const errorMsg = `Sheet ${sheetName}: ${error.message}`;
        Logger.log(`⚠️ Error updating sheet ${sheetName}: ${error.message}`);
        errors.push(errorMsg);
      }
    }

    SpreadsheetApp.flush();
    Logger.log(`✅ Completed: ${sheetsUpdated} sheets updated successfully`);

    if (errors.length === 0) {
      ui.alert(
        '✅ העדכון הושלם בהצלחה!',
        `${sheetsUpdated} גיליונות עודכנו בהצלחה.\n\n` +
        '⚠️ אנא הוסף את הסכומים הכוללים באופן ידני.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '⚠️ העדכון הושלם עם שגיאות',
        `${sheetsUpdated} גיליונות עודכנו בהצלחה.\n\n` +
        `שגיאות (${errors.length}):\n${errors.join('\n')}\n\n` +
        '⚠️ אנא הוסף את הסכומים הכוללים באופן ידני.',
        ui.ButtonSet.OK
      );
    }

  } catch (error) {
    Logger.log(`❌ ERROR in updateAllSheetsStructure: ${error.toString()}`);
    ui.alert(
      '❌ אירעה שגיאה',
      `השגיאה: ${error.toString()}\n\nבדוק את הלוג לפרטים נוספים.`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Updates a single sheet's product structure
 * Preserves existing quantity data while updating product names and rows
 */
function updateSheetStructure(sheet) {
  // Step 1: Read all existing data (preserve quantities)
  const lastRow = sheet.getLastRow();
  const existingData = {};

  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 5);
    const values = dataRange.getValues();

    // Map existing products by name to preserve quantities
    values.forEach((row, index) => {
      const productName = row[0]; // Column A: Product name
      const quantity = row[2]; // Column C: Quantity
      if (productName && productName.trim() !== '') {
        existingData[productName.trim()] = quantity || 0;
      }
    });
  }

  Logger.log(`Sheet ${sheet.getName()}: Found ${Object.keys(existingData).length} existing products with data`);

  // Step 2: Clear old product rows (rows 2-81 in old structure, custom products stay)
  // We'll clear rows 2-100 to be safe, but preserve anything beyond row 100
  if (lastRow > 1) {
    const clearRange = sheet.getRange(2, 1, Math.min(99, lastRow - 1), 5);
    clearRange.clearContent();
  }

  // Step 3: Ensure RTL (right-to-left) direction is maintained
  sheet.setRightToLeft(true);

  // Step 4: Write new product structure with preserved quantities
  Object.entries(BACKUP_PRODUCT_ROW_MAP)
    .sort((a, b) => a[1].row - b[1].row)
    .forEach(([key, info]) => {
      const existingQuantity = existingData[info.name] || 0;
      const rowData = [info.name, info.category, existingQuantity, '', ''];
      sheet.getRange(info.row, 1, 1, 5).setValues([rowData]);
    });

  Logger.log(`Sheet ${sheet.getName()}: Updated with ${Object.keys(BACKUP_PRODUCT_ROW_MAP).length} products`);
}

// ============================================================================
// CLEANUP FUNCTIONS - Remove incorrectly named sheets
// ============================================================================

/**
 * Removes incorrectly named sheets "1", "2", ..., "9" that may have been created
 * These should be "01", "02", ..., "09" instead
 * Run this manually if you need to clean up after the backup bug
 */
function removeIncorrectlyNamedSheets() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert(
    '⚠️ מחיקת גיליונות שגויים',
    'פעולה זו תמחק גיליונות בעלי שמות שגויים:\n\n' +
    '🗑️ גיליונות למחיקה: "1", "2", "3", "4", "5", "6", "7", "8", "9"\n\n' +
    '⚠️ הגיליונות הנכונים "01"-"09" יישארו ללא פגע\n\n' +
    'האם להמשיך?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('הפעולה בוטלה');
    return;
  }

  try {
    const ss = SpreadsheetApp.openById(BACKUP_SPREADSHEET_ID);
    let sheetsDeleted = 0;
    const deletedSheets = [];

    Logger.log('Starting to remove incorrectly named sheets...');

    // Check for sheets named "1" through "9" (without leading zero)
    for (let day = 1; day <= 9; day++) {
      try {
        const incorrectName = day.toString();
        const sheet = ss.getSheetByName(incorrectName);

        if (sheet) {
          Logger.log(`Deleting incorrectly named sheet: "${incorrectName}"`);
          ss.deleteSheet(sheet);
          sheetsDeleted++;
          deletedSheets.push(incorrectName);
        }
      } catch (error) {
        Logger.log(`⚠️ Error deleting sheet ${day}: ${error.message}`);
      }
    }

    Logger.log(`✅ Completed: ${sheetsDeleted} incorrectly named sheets deleted`);

    if (sheetsDeleted > 0) {
      ui.alert(
        '✅ המחיקה הושלמה!',
        `${sheetsDeleted} גיליונות שגויים נמחקו:\n${deletedSheets.join(', ')}\n\n` +
        'הגיליונות הנכונים "01"-"31" נשארו ללא פגע.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'ℹ️ לא נמצאו גיליונות שגויים',
        'כל הגיליונות בעלי שמות נכונים ("01"-"31").',
        ui.ButtonSet.OK
      );
    }

  } catch (error) {
    Logger.log(`❌ ERROR in removeIncorrectlyNamedSheets: ${error.toString()}`);
    ui.alert(
      '❌ אירעה שגיאה',
      `השגיאה: ${error.toString()}\n\nבדוק את הלוג לפרטים נוספים.`,
      ui.ButtonSet.OK
    );
  }
}

// ============================================================================
// MANUAL TRIGGER FUNCTIONS (for testing and manual use)
// ============================================================================

function manualBackupAndReset() {
  const ui = SpreadsheetApp.getUi();

  if (SAFE_TEST_MODE) {
    const response = ui.alert(
      '🧪 בדיקת גיבוי (מצב בטוח)',
      'פעולה זו תבצע:\n\n' +
        '✅ גיבוי של כל הנתונים הקיימים\n' +
        '🛡️ ללא איפוס נתונים (מצב בדיקה)\n\n' +
        'זוהי בדיקה בטוחה - שום נתון לא יימחק.\n\n' +
        'האם להמשיך?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      ui.alert('הפעולה בוטלה');
      return;
    }

    ui.alert('הבדיקה מתבצעת...\n\nזה עשוי לקחת מספר שניות.\nאנא המתן.');

    const result = backupAndResetMonthly();

    if (result.success) {
      ui.alert(
        '✅ הבדיקה הושלמה בהצלחה!',
        `🧪 מצב בדיקה - שום נתון לא נמחק\n\n` +
          `הגיבוי נוצר: ${result.backup.fileName}\n\n` +
          `✅ כל ההרשאות פועלות כראוי\n` +
          `✅ המערכת מוכנה לשימוש בייצור\n\n` +
          `נשלח אימייל עם פרטי הבדיקה.\n\n` +
          `להפעלת מצב ייצור:\n` +
          `שנה SAFE_TEST_MODE = false בקוד`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '❌ אירעה שגיאה',
        `השגיאה: ${result.error}\n\nנשלח אימייל עם הפרטים.`,
        ui.ButtonSet.OK
      );
    }
  } else {
    const response = ui.alert(
      '⚠️ גיבוי ואיפוס חודשי (מצב ייצור)',
      'פעולה זו תבצע:\n\n' +
        '1. גיבוי של כל הנתונים הקיימים\n' +
        '2. ⚠️ איפוס מלא של כל 31 הגיליונות\n\n' +
        '🔴 זוהי פעולה הרסנית!\n\n' +
        'האם להמשיך?',
      ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
      ui.alert('הפעולה בוטלה');
      return;
    }

    const confirm = ui.alert(
      'אישור סופי',
      'האם אתה בטוח שברצונך למחוק את כל הנתונים?\n\nפעולה זו לא ניתנת לביטול!',
      ui.ButtonSet.YES_NO
    );

    if (confirm !== ui.Button.YES) {
      ui.alert('הפעולה בוטלה');
      return;
    }

    ui.alert('התהליך מתבצע...\n\nזה עשוי לקחת מספר שניות.\nאנא המתן.');

    const result = backupAndResetMonthly();

    if (result.success) {
      ui.alert(
        '✅ הפעולה הושלמה בהצלחה!',
        `הגיבוי נוצר: ${result.backup.fileName}\n\n` +
          `${result.reset.sheetsReset} גיליונות אופסו בהצלחה.\n\n` +
          `נשלח אימייל עם קישור לגיבוי.`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ אירעה שגיאה', `השגיאה: ${result.error}\n\nיש לבצע גיבוי ידני.`, ui.ButtonSet.OK);
    }
  }
}

function manualBackupOnly() {
  const ui = SpreadsheetApp.getUi();

  const testPrefix = SAFE_TEST_MODE ? ' (בדיקה)' : '';
  const response = ui.alert(
    'גיבוי בלבד' + testPrefix,
    'ליצור גיבוי ללא איפוס?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const result = createMonthlyBackup();

  if (result.success) {
    ui.alert(
      '✅ גיבוי נוצר בהצלחה!\n\n' +
        result.fileName +
        '\n\n' +
        (SAFE_TEST_MODE ? '🧪 גיבוי בדיקה (ללא איפוס נתונים)' : '📁 גיבוי רגיל')
    );
  } else {
    ui.alert('❌ שגיאה: ' + result.error);
  }
}

function manualResetOnly() {
  const ui = SpreadsheetApp.getUi();

  if (SAFE_TEST_MODE) {
    ui.alert(
      '🛡️ מצב בדיקה פעיל',
      'איפוס נתונים חסום במצב בדיקה.\n\n' +
        'כדי לאפשר איפוס:\n' +
        'שנה SAFE_TEST_MODE = false בקוד',
      ui.ButtonSet.OK
    );
    return;
  }

  const response = ui.alert(
    '⚠️ אזהרה!',
    'פעולה זו תמחק את כל הנתונים!\n\nהאם ביצעת גיבוי?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  const confirm = ui.alert('אישור סופי', 'באמת למחוק הכל?', ui.ButtonSet.YES_NO);

  if (confirm !== ui.Button.YES) return;

  const result = resetAllSheetsForBackup();

  if (result.success) {
    ui.alert('✅ ' + result.sheetsReset + ' גיליונות אופסו בהצלחה');
  } else {
    ui.alert('❌ שגיאה: ' + result.error);
  }
}

// ============================================================================
// MODE CHECK FUNCTION
// ============================================================================

function checkCurrentMode() {
  const ui = SpreadsheetApp.getUi();

  if (SAFE_TEST_MODE) {
    ui.alert(
      '🧪 מצב נוכחי: בדיקה (SAFE)',
      'המערכת במצב בדיקה בטוח.\n\n' +
        '✅ גיבויים יעבדו כרגיל\n' +
        '🛡️ נתונים לא יימחקו\n\n' +
        'להפעלת מצב ייצור:\n' +
        'שנה SAFE_TEST_MODE = false בקוד',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      '⚠️ מצב נוכחי: ייצור (PRODUCTION)',
      'המערכת במצב ייצור!\n\n' +
        '✅ גיבויים יעבדו\n' +
        '🔴 נתונים יימחקו בגיבוי אוטומטי\n\n' +
        'לחזרה למצב בדיקה:\n' +
        'שנה SAFE_TEST_MODE = true בקוד',
      ui.ButtonSet.OK
    );
  }
}
