// Reproduces the 24/10 bug: the day-24 sheet still held data from another
// date, the new order was treated as the day's first order, and the old
// quantities were ADDED to it (בריוש סוכרה 3 → 103, ~25 unselected products).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackend } = require('./gas-harness');

const p = (key, name, category, quantity, notes = '') => ({ key, name, category, quantity: String(quantity), notes });

// The order from the bug report
const ORDER_PRODUCTS = [
  p('sweet_croissant_butter', 'קרואסון חמאה', 'מאפים מתוקים', 2),
  p('sweet_croissant_almonds', 'קרואסון שקדים', 'מאפים מתוקים', 5),
  p('sweet_brioche_sugar', 'בריוש סוכרה', 'מאפים מתוקים', 3),
  p('sandwiches_beet_sourdough', 'מחמצת סלק', 'כריכים', 1),
  p('shelf_yeast_cake', 'עוגת שמרים', 'מוצרי מדף', 3),
  p('various_mushroom_pastry', 'מאפה פטריות', 'מוצרים שונים', 2),
  p('custom_1', 'בדיקה', 'אחרים', 10),
];

function setupWithLeftovers({ withOrderInfo = true } = {}) {
  const b = loadBackend();
  const sheet = b.addDaySheet('24');
  const map = b.exported.getCombinedProductMap();
  const C = b.exported.COLUMNS;
  const set = (key, qty, notes) => {
    sheet.set(map[key].row, C.QUANTITY, qty);
    if (notes) sheet.set(map[key].row, C.NOTES, notes);
  };
  // Leftovers from 24/09
  set('sweet_croissant_butter', 2);
  set('sweet_croissant_almonds', 1);
  set('sweet_brioche_sugar', 100);
  set('sandwiches_beet_sourdough', 3, '1');
  set('various_mushroom_pastry', 2);
  set('salty_empty_bagel', 30);
  set('vitrina_paris_brest', 8);
  sheet.set(b.exported.getCustomProductsStartRow(), 1, 'מוצר ישן');
  sheet.set(b.exported.getCustomProductsStartRow(), 2, 'אחרים');
  sheet.set(b.exported.getCustomProductsStartRow(), 3, 4);
  if (withOrderInfo) {
    sheet.set(2, C.LAST_UPDATED, '24/09/2026 08:10');
    sheet.set(2, C.DATE, '24/09/2026');
    sheet.set(2, C.SUBMISSION_ID, 'old_september_id');
    sheet.set(2, C.CONFIRMATION_STATUS, 'confirmed');
  }
  const qtyOf = (key) => sheet.get(map[key].row, C.QUANTITY);
  return { ...b, sheet, map, C, qtyOf };
}

function nonZeroRows(t) {
  const out = {};
  for (let r = 2; r <= t.sheet.getLastRow(); r++) {
    const q = parseInt(t.sheet.get(r, t.C.QUANTITY), 10) || 0;
    if (q) out[t.sheet.get(r, 1)] = q;
  }
  return out;
}

const ORDER = {
  submission_id: 'new_oct_id',
  delivery_date: '24/10/2026',
  certificate_number: '',
  filler_name: 'אדל',
  products: ORDER_PRODUCTS,
};

const EXPECTED = {
  'קרואסון חמאה': 2,
  'קרואסון שקדים': 5,
  'בריוש סוכרה': 3,
  'מחמצת סלק': 1,
  'עוגת שמרים': 3,
  'מאפה פטריות': 2,
  'בדיקה': 10,
};

test('BUG 24/10: leftovers from another date are not merged into the new order', () => {
  const t = setupWithLeftovers();
  const res = t.post(ORDER);

  assert.equal(res.success, true);
  assert.equal(res.mode, 'order');
  assert.deepEqual(nonZeroRows(t), EXPECTED, 'sheet holds exactly the order, nothing else');
  assert.deepEqual(res.mismatches, []);
  assert.equal(t.sheet.get(2, t.C.SUBMISSION_ID), 'new_oct_id');
  assert.equal(t.sheet.get(2, t.C.CONFIRMATION_STATUS), 'pending');
  assert.equal(t.sheet.get(t.map.sandwiches_beet_sourdough.row, t.C.NOTES), '', 'old note removed');

  // Email to Shalev lists only the ordered products
  const email = t.emails.find((e) => /מחכה לאישורך/.test(e.subject));
  assert.match(email.body, /סה"כ מוצרים: 7/);
});

test('leftovers are archived before being cleared, so nothing is lost', () => {
  const t = setupWithLeftovers();
  t.post(ORDER);
  const archive = t.ss.getSheetByName('ארכיון נתונים שנוקו');
  assert.ok(archive, 'archive sheet created');
  const rows = archive.getRange(2, 1, archive.getLastRow() - 1, 9).getValues();
  const byName = Object.fromEntries(rows.map((r) => [r[5], r]));
  assert.equal(byName['בריוש סוכרה'][7], 100);
  assert.equal(byName['בריוש סוכרה'][2], '24/09/2026');
  assert.equal(byName['בריוש סוכרה'][3], 'old_september_id');
  assert.equal(byName['מוצר ישן'][7], 4);
  assert.equal(rows.length, 8);
});

test('leftover quantities with no order info at all (test residue / manual typing) are cleared too', () => {
  const t = setupWithLeftovers({ withOrderInfo: false });
  t.post(ORDER);
  assert.deepEqual(nonZeroRows(t), EXPECTED);
});

test('a clean sheet is left alone (no archive sheet created)', () => {
  const b = loadBackend();
  b.addDaySheet('24');
  b.post(ORDER);
  assert.equal(b.ss.getSheetByName('ארכיון נתונים שנוקו'), null);
});

test('second order on the same date still goes to approval and is NOT cleared', () => {
  const t = setupWithLeftovers();
  t.post(ORDER);
  const res = t.post({ ...ORDER, submission_id: 'second', products: [p('sweet_brioche_sugar', 'בריוש סוכרה', 'מאפים מתוקים', 7)] });
  assert.equal(res.mode, 'update_request');
  assert.deepEqual(nonZeroRows(t), EXPECTED, 'first order untouched until approval');
});

test('read-after-write check reports a product that could not be written', () => {
  const t = setupWithLeftovers();
  t.sheet.set(t.map.various_butter.row, 1, ''); // row for "חמאה" missing in the sheet
  const res = t.post({ ...ORDER, products: [...ORDER_PRODUCTS, p('various_butter', 'חמאה', 'מוצרים שונים', 2)] });
  assert.deepEqual(res.mismatches, [{ name: 'חמאה', requested: 2, in_sheet: null }]);
});

test('old submission id with no readable date counts as leftover data and is cleared', () => {
  const t = setupWithLeftovers({ withOrderInfo: false });
  t.sheet.set(2, t.C.SUBMISSION_ID, 'old_id_without_date');
  const res = t.post(ORDER);
  assert.equal(res.mode, 'order', 'not sent to approval');
  assert.deepEqual(nonZeroRows(t), EXPECTED);
});
