const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackend } = require('./gas-harness');

const DATE = '05/10/2026';

function order(id, products, extra = {}) {
  return {
    submission_id: id,
    delivery_date: DATE,
    certificate_number: '123',
    filler_name: 'דנה',
    products,
    ...extra,
  };
}

const croissant = (quantity) => ({
  key: 'sweet_croissant_butter',
  name: 'קרואסון חמאה',
  category: 'מאפים מתוקים',
  quantity: String(quantity),
  notes: '',
});

function setup() {
  const b = loadBackend();
  const sheet = b.addDaySheet('05');
  const row = (key) => b.exported.getCombinedProductMap()[key].row;
  const qty = (key) => sheet.get(row(key), b.exported.COLUMNS.QUANTITY);
  const updates = () => b.ss.getSheetByName(b.exported.UPDATES_SHEET_NAME);
  return { ...b, sheet, row, qty, updates };
}

function approvalParams(email) {
  const m = email.body.match(/approve\.html\?id=([^&\s]+)&token=([^&\s]+)/);
  assert.ok(m, 'approval link present in email');
  return { id: decodeURIComponent(m[1]), token: decodeURIComponent(m[2]) };
}

test('first order of the day is written as-is', () => {
  const t = setup();
  const res = t.post(order('s1', [croissant(5)]));
  assert.equal(res.success, true);
  assert.equal(res.mode, 'order');
  assert.equal(t.qty('sweet_croissant_butter'), 5);
});

test('retrying the same submission never doubles quantities', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  t.post(order('s1', [croissant(5)]));
  t.post(order('s1', [croissant(5)]));
  assert.equal(t.qty('sweet_croissant_butter'), 5);
  assert.equal(t.emails.length, 1, 'only one confirmation email');
});

test('second order for the same day does not touch the sheet and goes to approval', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  const res = t.post(order('s2', [croissant(8)]));

  assert.equal(res.success, true);
  assert.equal(res.mode, 'update_request');
  assert.equal(t.qty('sweet_croissant_butter'), 5, 'sheet unchanged until approval');
  assert.equal(t.sheet.get(2, t.exported.COLUMNS.SUBMISSION_ID), 's1', 'original submission kept');

  const email = t.emails[t.emails.length - 1];
  assert.equal(email.to, '6b1b9b@gmail.com');
  assert.match(email.subject, /בקשת עדכון/);
  assert.match(email.body, /קרואסון חמאה: 5 → 8/);
});

test('explicit update_request action is stored once per submission id', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  const before = t.emails.length;
  t.post(order('u1', [croissant(8)], { action: 'update_request' }));
  t.post(order('u1', [croissant(8)], { action: 'update_request' }));
  assert.equal(t.updates().getLastRow(), 2, 'header + one request row');
  assert.equal(t.emails.length, before + 1);
});

test('approval REPLACES the quantity (not add/subtract) and is idempotent', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  t.post(order('s2', [croissant(3)]));
  const { id, token } = approvalParams(t.emails[t.emails.length - 1]);

  const view = t.get({ action: 'get_update_request', id, token });
  assert.equal(view.success, true);
  assert.deepEqual(
    view.request.products.map((p) => [p.name, p.current_quantity, p.new_quantity]),
    [['קרואסון חמאה', 5, 3]]
  );

  const res = t.get({ action: 'approve_update', id, token });
  assert.equal(res.success, true);
  assert.equal(t.qty('sweet_croissant_butter'), 3);

  const again = t.get({ action: 'approve_update', id, token });
  assert.equal(again.already_approved, true);
  assert.equal(t.qty('sweet_croissant_butter'), 3);
});

test('approval with a wrong token is rejected', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  t.post(order('s2', [croissant(9)]));
  const { id } = approvalParams(t.emails[t.emails.length - 1]);
  const res = t.get({ action: 'approve_update', id, token: 'nope' });
  assert.equal(res.success, false);
  assert.equal(t.qty('sweet_croissant_butter'), 5);
});

test('duplicate product name ("פאדג\' שוקולד") is updated in its own category row', () => {
  const t = setup();
  t.post(order('s1', [croissant(1)]));
  t.post(
    order('s2', [
      { key: 'vitrina_chocolate_fudge', name: "פאדג' שוקולד", category: 'קינוחי ויטרינה', quantity: '4' },
    ])
  );
  const { id, token } = approvalParams(t.emails[t.emails.length - 1]);
  t.get({ action: 'approve_update', id, token });
  assert.equal(t.qty('vitrina_chocolate_fudge'), 4);
  assert.equal(t.qty('whole_cakes_chocolate_fudge'), '', 'whole-cake row untouched');
});

test('approved custom product missing from the sheet is appended in the custom area', () => {
  const t = setup();
  t.post(order('s1', [croissant(1)]));
  t.post(order('s2', [{ key: 'custom_1', name: 'עוגה מיוחדת', category: 'אחרים', quantity: '2' }]));
  const { id, token } = approvalParams(t.emails[t.emails.length - 1]);
  t.get({ action: 'approve_update', id, token });

  const r = t.exported.findProductRow(
    t.sheet.getRange(2, 1, t.sheet.getLastRow() - 1, 1).getValues().map((x) => x[0]),
    { key: 'custom_1', name: 'עוגה מיוחדת' },
    t.exported.getCombinedProductMap(),
    t.exported.getCustomProductsStartRow()
  );
  assert.ok(r >= t.exported.getCustomProductsStartRow());
  assert.equal(t.sheet.get(r, 3), 2);
});

test('permanent ("מוצר קבוע") product update replaces its own row, not a new אחרים row', () => {
  const t = setup();
  t.post(order('s1', [croissant(1)]));
  const fixed = { key: 'fixed_test_product', name: 'מוצר קבוע לבדיקה', category: 'מאפים מתוקים', quantity: '6' };
  t.post(order('s2', [fixed]));
  const { id, token } = approvalParams(t.emails[t.emails.length - 1]);
  t.get({ action: 'approve_update', id, token });
  assert.equal(t.qty('fixed_test_product'), 6);
  assert.equal(t.sheet.get(t.exported.getCustomProductsStartRow(), 1), '', 'nothing appended to אחרים');
});

test('check_day reports existing orders and whose submission landed', () => {
  const t = setup();
  assert.equal(t.get({ action: 'check_day', date: DATE }).exists, false);
  t.post(order('s1', [croissant(5)]));
  t.post(order('s2', [croissant(6)]));

  assert.equal(t.get({ action: 'check_day', date: DATE }).exists, true);
  assert.equal(t.get({ action: 'check_day', date: DATE, submission_id: 's1' }).own_submission, 'order');
  assert.equal(
    t.get({ action: 'check_day', date: DATE, submission_id: 's2' }).own_submission,
    'update_request'
  );
  assert.equal(t.get({ action: 'check_day', date: DATE, submission_id: 'zzz' }).own_submission, null);
});

test('update_request for a day without an order is processed as a normal order', () => {
  const t = setup();
  const res = t.post(order('u1', [croissant(7)], { action: 'update_request' }));
  assert.equal(res.mode, 'order');
  assert.equal(t.qty('sweet_croissant_butter'), 7);
});

test('a leftover order from another month does not block a new order', () => {
  const t = setup();
  t.post(order('old', [croissant(2)], { delivery_date: '05/09/2026' }));
  assert.equal(t.exported.dayHasExistingOrder(t.sheet, DATE), false);
});

test('F2 auto-converted to a Date (US locale, day/month swapped) still counts as the same day', () => {
  const t = setup();
  t.sheet.set(2, t.exported.COLUMNS.DATE, new Date(2026, 4, 10)); // "05/10/2026" read as May 10
  t.sheet.set(2, t.exported.COLUMNS.SUBMISSION_ID, 's1');
  assert.equal(t.exported.dayHasExistingOrder(t.sheet, DATE), true);
});

test('unknown GET actions still reach the original doGet handlers', () => {
  const t = setup();
  const res = t.get({ action: 'get_products_list' });
  assert.equal(res.success, true);
  assert.ok(res.products.length > 50);
});
