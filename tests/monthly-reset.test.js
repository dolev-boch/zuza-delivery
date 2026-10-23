const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackend } = require('./gas-harness');

// A month with data in several day sheets, incl. a permanent product and an
// "אחרים" row, plus a summary sheet that must never be touched.
function setupMonth() {
  const b = loadBackend();
  const map = b.exported.getCombinedProductMap();
  const C = b.exported.COLUMNS;
  const customStart = b.exported.getCustomProductsStartRow();
  const sheets = {};
  ['01', '24', '28', '31'].forEach((d) => (sheets[d] = b.addDaySheet(d)));

  const fill = (day, key, qty, notes) => {
    sheets[day].set(map[key].row, C.QUANTITY, qty);
    if (notes) sheets[day].set(map[key].row, C.NOTES, notes);
  };
  fill('24', 'sweet_brioche_sugar', 100, 'הערה');
  fill('24', 'fixed_test_product', 6);
  fill('28', 'sweet_croissant_butter', 12);
  fill('31', 'salty_empty_bagel', 30);
  sheets['28'].set(customStart, 1, 'מוצר אחר');
  sheets['28'].set(customStart, 2, 'אחרים');
  sheets['28'].set(customStart, 3, 4);
  sheets['24'].set(2, C.LAST_UPDATED, '24/10/2026 08:00');
  sheets['24'].set(2, C.DATE, '24/10/2026');
  sheets['24'].set(2, C.SUBMISSION_ID, 'oct24');
  sheets['24'].set(2, C.CONFIRMATION_STATUS, 'confirmed');

  const summary = b.ss.insertSheet('סיכום חודש');
  summary.set(2, 1, 'קרואסון חמאה');
  summary.set(2, 2, 12.5);

  return { ...b, map, C, customStart, sheets, summary };
}

const totalQty = (sheet) => {
  let s = 0;
  for (let r = 2; r <= sheet.getLastRow(); r++) s += parseInt(sheet.get(r, 3), 10) || 0;
  return s;
};

test('backs up to Drive as a separate file FIRST, then zeroes every day sheet', () => {
  const t = setupMonth();
  const res = t.context.runMonthlyBackupAndZero(new Date(2026, 9, 1), { skipIfDone: false });
  assert.equal(res.success, true, res.error);

  // Backup: one separate file, in the backup folder, named with the month, holding the old data
  const copies = Object.values(t.driveCopies);
  assert.equal(copies.length, 1);
  assert.equal(copies[0].folderId, 'backup_folder');
  assert.match(copies[0].name, /אוקטובר 2026/);
  assert.equal(totalQty(copies[0].ss.getSheetByName('24')), 106);
  assert.equal(totalQty(copies[0].ss.getSheetByName('28')), 16);

  // Main file: every quantity is 0
  Object.values(t.sheets).forEach((s) => assert.equal(totalQty(s), 0, `sheet ${s.getName()} zeroed`));
  assert.equal(res.sheetsZeroed, 4);
  assert.equal(res.totalUnitsBackedUp, 152);
});

test('zeroing keeps the structure: names, categories and permanent products stay, quantity 0', () => {
  const t = setupMonth();
  t.context.runMonthlyBackupAndZero(new Date(2026, 9, 1), { skipIfDone: false });
  const s24 = t.sheets['24'];
  const row = t.map.sweet_brioche_sugar.row;
  assert.equal(s24.get(row, 1), 'בריוש סוכרה');
  assert.equal(s24.get(row, 2), 'מאפים מתוקים');
  assert.equal(s24.get(row, 3), 0);
  assert.equal(s24.get(row, 4), '', 'notes cleared');
  assert.equal(s24.get(t.map.fixed_test_product.row, 1), 'מוצר קבוע לבדיקה', 'permanent product kept');
  assert.equal(s24.get(t.map.fixed_test_product.row, 3), 0);
  assert.equal(s24.get(2, t.C.SUBMISSION_ID), '', 'order details cleared');
  assert.equal(s24.get(2, t.C.DATE), '');
  assert.equal(t.sheets['28'].get(t.customStart, 1), '', '"אחרים" rows removed');
});

test('summary sheet is never touched', () => {
  const t = setupMonth();
  t.context.runMonthlyBackupAndZero(new Date(2026, 9, 1), { skipIfDone: false });
  assert.equal(t.summary.get(2, 1), 'קרואסון חמאה');
  assert.equal(t.summary.get(2, 2), 12.5);
});

test('if the Drive backup fails, NOTHING is zeroed and the manager is told', () => {
  const t = setupMonth();
  t.drive.failCopy = true;
  const res = t.context.runMonthlyBackupAndZero(new Date(2026, 9, 1), { skipIfDone: false });
  assert.equal(res.success, false);
  assert.equal(totalQty(t.sheets['24']), 106, 'data untouched');
  const mail = t.emails.pop();
  assert.equal(mail.to, 'zuzatiberias@gmail.com');
  assert.match(mail.subject, /נכשל/);
});

test('if the backup copy does not match the main file, NOTHING is zeroed', () => {
  const t = setupMonth();
  t.drive.corruptCopy = true;
  const res = t.context.runMonthlyBackupAndZero(new Date(2026, 9, 1), { skipIfDone: false });
  assert.equal(res.success, false);
  assert.match(res.error, /לא תואם/);
  assert.equal(totalQty(t.sheets['28']), 16, 'data untouched');
});

test('the monthly trigger closes the PREVIOUS month and runs at most once per month', () => {
  const t = setupMonth();
  const first = t.context.monthlyBackupAndZero();
  assert.equal(first.success, true);
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  assert.equal(
    t.props.MONTHLY_RESET_DONE_FOR,
    `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  );

  const again = t.context.monthlyBackupAndZero();
  assert.equal(again.skipped, true);
  assert.equal(Object.keys(t.driveCopies).length, 1, 'no second backup');
});

test('installing the trigger replaces the old reset job and never duplicates', () => {
  const t = setupMonth();
  t.context.ScriptApp.newTrigger('backupAndResetMonthly').timeBased().onMonthDay(1).atHour(0).create();
  t.context.ScriptApp.newTrigger('sendPendingConfirmationsReminderEmail').timeBased().atHour(9).create();
  t.context.installMonthlyResetTrigger();
  t.context.installMonthlyResetTrigger();

  const fns = t.triggers.map((x) => x.fn).sort();
  assert.deepEqual(fns, ['monthlyBackupAndZero', 'sendPendingConfirmationsReminderEmail']);
  const monthly = t.triggers.find((x) => x.fn === 'monthlyBackupAndZero');
  assert.equal(monthly.monthDay, 1);
  assert.equal(monthly.hour, 1);
});

test('after the reset, the next order of a day is written exactly as selected', () => {
  const t = setupMonth();
  t.context.runMonthlyBackupAndZero(new Date(2026, 9, 1), { skipIfDone: false });
  t.post({
    submission_id: 'nov1',
    delivery_date: '24/11/2026',
    products: [{ key: 'sweet_brioche_sugar', name: 'בריוש סוכרה', category: 'מאפים מתוקים', quantity: '3' }],
  });
  assert.equal(totalQty(t.sheets['24']), 3);
  assert.equal(t.sheets['24'].get(t.map.sweet_brioche_sugar.row, 3), 3);
});

test('clicking the menu item only schedules the run — current data is untouched', () => {
  const t = setupMonth();
  const res = t.context.installMonthlyResetTrigger();
  assert.equal(res.scheduled, true);
  assert.match(res.nextRun, /^01\/\d{2}\/\d{4}$/);
  assert.equal(Object.keys(t.driveCopies).length, 0, 'no backup made now');
  assert.equal(totalQty(t.sheets['24']), 106, 'nothing zeroed now');
  assert.equal(t.sheets['24'].get(2, t.C.SUBMISSION_ID), 'oct24');
});
