// ============================================================================
// ZUZA PATISSERIE - MONTHLY BACKUP + ZERO
// ----------------------------------------------------------------------------
// Once a month (1st of the month, ~01:00):
//   1. Back up: a full copy of this spreadsheet is saved as a SEPARATE file in
//      the Drive backup folder, named with the month whose data it holds.
//   2. Verify: the copy is opened and its total quantity per day sheet must
//      equal the main file's. If anything differs, nothing is zeroed.
//   3. Zero: every day sheet 01–31 of the main file is emptied — each product
//      keeps its name/category with quantity 0; notes, "אחרים" rows and the
//      order details are cleared. Structure and permanent products stay.
//   4. Email the manager with the backup link.
//
// Replaces the old backupAndResetMonthly() reset, which rebuilt each sheet
// from an outdated product list. Run installMonthlyResetTrigger() once.
// Relies on Code.gs / OrderUpdates.gs / CustomProducts.gs globals.
// ============================================================================

const MONTHLY_RESET_DONE_KEY = 'MONTHLY_RESET_DONE_FOR';

/** Time-trigger entry point (1st of each month). Closes the previous month. */
function monthlyBackupAndZero() {
  const now = new Date();
  const closing = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return runMonthlyBackupAndZero(closing, { skipIfDone: true });
}

/** Menu entry: back up + zero now, after confirmation. Labels the backup with the current month. */
function manualMonthlyBackupAndZero() {
  const ui = SpreadsheetApp.getUi();
  const answer = ui.alert(
    'גיבוי לדרייב ואיפוס כמויות',
    'שלב 1: עותק מלא של הקובץ יישמר כקובץ נפרד בתיקיית הגיבויים בדרייב.\n' +
      'שלב 2: הגיבוי ייבדק מול הקובץ הראשי.\n' +
      'שלב 3: רק אם הגיבוי תקין — כל הכמויות בגיליונות 01–31 יאופסו ל-0.\n\n' +
      'שמות המוצרים, הקטגוריות והמוצרים הקבועים לא ישתנו.\n\nלהמשיך?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return;

  const result = runMonthlyBackupAndZero(new Date(), { skipIfDone: false });
  ui.alert(
    result.success ? 'הושלם' : 'שגיאה',
    result.success
      ? '✅ הגיבוי נשמר ונבדק:\n' + result.backupName + '\n\n' + result.sheetsZeroed + ' גיליונות אופסו.'
      : '❌ ' + result.error + '\n\nלא בוצע איפוס.',
    ui.ButtonSet.OK
  );
}

/** Run once from the editor or the menu: installs the monthly trigger. */
function installMonthlyResetTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    const fn = trigger.getHandlerFunction();
    // The old job rebuilt sheets from an outdated product list — never run both
    if (fn === 'backupAndResetMonthly' || fn === 'monthlyBackupAndZero') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('monthlyBackupAndZero').timeBased().onMonthDay(1).atHour(1).create();
  Logger.log('Monthly backup + zero trigger installed (1st of each month, ~01:00)');
  try {
    SpreadsheetApp.getUi().alert('✅ הופעל: גיבוי לדרייב ואיפוס כמויות יתבצע אוטומטית ב-1 לכל חודש בסביבות 01:00.');
  } catch (err) {
    // Run from the editor — no UI
  }
}

// ============================================================================
// CORE
// ============================================================================

function runMonthlyBackupAndZero(monthDate, options) {
  const monthKey = monthDate.getFullYear() + '-' + String(monthDate.getMonth() + 1).padStart(2, '0');
  const props = PropertiesService.getScriptProperties();
  if (options.skipIfDone && props.getProperty(MONTHLY_RESET_DONE_KEY) === monthKey) {
    Logger.log('Monthly backup + zero already done for ' + monthKey + ' — skipping');
    return { success: true, skipped: true };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT)) {
    return mrFail('המערכת עסוקה (שליחת הזמנה?) — נסה שוב בעוד דקה.', monthKey);
  }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const daySheets = mrDaySheets(ss);
    const mainTotals = mrQuantityTotals(daySheets);

    // 1. Backup as a separate file
    const backupName =
      'גיבוי משלוחים זוזה - ' + HEBREW_MONTH_NAMES[monthDate.getMonth()] + ' ' + monthDate.getFullYear() +
      ' (נוצר ' + getIsraeliTime().replace(/:/g, '-') + ')';
    const backupFile = DriveApp.getFileById(SPREADSHEET_ID).makeCopy(backupName, mrBackupFolder());
    SpreadsheetApp.flush();

    // 2. Verify the copy before touching anything
    const copyTotals = mrQuantityTotals(mrDaySheets(SpreadsheetApp.openById(backupFile.getId())));
    const problems = Object.keys(mainTotals).filter(function(name) {
      return copyTotals[name] !== mainTotals[name];
    });
    if (problems.length) {
      return mrFail('הגיבוי לא תואם לקובץ הראשי בגיליונות: ' + problems.join(', '), monthKey, backupFile);
    }

    // 3. Zero every day sheet
    const customStartRow = ouCustomStartRow();
    daySheets.forEach(function(sheet) { clearDayOrderArea(sheet, customStartRow); });
    SpreadsheetApp.flush();

    props.setProperty(MONTHLY_RESET_DONE_KEY, monthKey);
    const totalUnits = Object.keys(mainTotals).reduce(function(s, k) { return s + mainTotals[k]; }, 0);
    mrNotify(true, monthKey, backupFile, daySheets.length, totalUnits);
    Logger.log('Monthly backup + zero done for ' + monthKey + ': ' + backupFile.getUrl());

    return {
      success: true,
      backupName: backupName,
      backupUrl: backupFile.getUrl(),
      sheetsZeroed: daySheets.length,
      totalUnitsBackedUp: totalUnits
    };
  } catch (err) {
    return mrFail(String(err), monthKey);
  } finally {
    lock.releaseLock();
  }
}

function mrDaySheets(ss) {
  const sheets = [];
  for (let d = 1; d <= 31; d++) {
    const sheet = ss.getSheetByName(d < 10 ? '0' + d : String(d));
    if (sheet) sheets.push(sheet);
  }
  return sheets;
}

/** { sheetName: sum of column C } — used to prove the backup holds the same data. */
function mrQuantityTotals(daySheets) {
  const totals = {};
  daySheets.forEach(function(sheet) {
    const lastRow = sheet.getLastRow();
    let sum = 0;
    if (lastRow >= 2) {
      sheet.getRange(2, COLUMNS.QUANTITY, lastRow - 1, 1).getValues().forEach(function(r) {
        sum += parseFloat(r[0]) || 0;
      });
    }
    totals[sheet.getName()] = sum;
  });
  return totals;
}

function mrBackupFolder() {
  if (typeof BACKUP_FOLDER_ID !== 'undefined' && BACKUP_FOLDER_ID) {
    return DriveApp.getFolderById(BACKUP_FOLDER_ID);
  }
  const parents = DriveApp.getFileById(SPREADSHEET_ID).getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}

function mrFail(message, monthKey, backupFile) {
  Logger.log('Monthly backup + zero FAILED for ' + monthKey + ': ' + message);
  mrNotify(false, monthKey, backupFile || null, 0, 0, message);
  return { success: false, error: message };
}

function mrNotify(ok, monthKey, backupFile, sheetsZeroed, totalUnits, error) {
  const subject = ok
    ? '✅ גיבוי ואיפוס חודשי הושלם - ' + monthKey
    : '❌ גיבוי ואיפוס חודשי נכשל - ' + monthKey + ' (לא בוצע איפוס)';
  const body = ok
    ? 'הגיבוי נשמר כקובץ נפרד בדרייב ונבדק מול הקובץ הראשי.\n' +
      'קובץ גיבוי: ' + backupFile.getName() + '\n' + backupFile.getUrl() + '\n\n' +
      'סה"כ יחידות שגובו: ' + totalUnits + '\n' +
      'גיליונות שאופסו: ' + sheetsZeroed
    : 'הגיבוי או הבדיקה נכשלו, ולכן הקובץ הראשי לא אופס.\n\nשגיאה: ' + error +
      (backupFile ? '\n\nקובץ גיבוי (לבדיקה): ' + backupFile.getUrl() : '');
  try {
    MailApp.sendEmail({ to: EMAIL_MANAGER, subject: subject, body: body, name: 'זוזה פטיסרי - מערכת משלוחים' });
  } catch (err) {
    Logger.log('Monthly reset notification failed: ' + err);
  }
}
