// Shalev's confirmation (confirm.html → action 'confirm') must keep working in
// every order of events: with no update at all, with an update still pending,
// with an update approved before or after he confirms, and on retries.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadBackend } = require('./gas-harness');

const DATE = '05/10/2026';
const DAY = '05';

const croissant = (quantity) => ({
  key: 'sweet_croissant_butter',
  name: 'קרואסון חמאה',
  category: 'מאפים מתוקים',
  quantity: String(quantity),
  notes: '',
});
const pecan = (quantity) => ({
  key: 'sweet_pecan_pastry',
  name: 'מאפה פקאן',
  category: 'מאפים מתוקים',
  quantity: String(quantity),
  notes: '',
});

const order = (id, products, extra = {}) => ({
  submission_id: id,
  delivery_date: DATE,
  certificate_number: '123',
  filler_name: 'דנה',
  products,
  ...extra,
});

function setup() {
  const b = loadBackend();
  const sheet = b.addDaySheet(DAY);
  const qty = (key) => sheet.get(b.exported.getCombinedProductMap()[key].row, b.exported.COLUMNS.QUANTITY);
  const status = () => sheet.get(2, b.exported.COLUMNS.CONFIRMATION_STATUS);

  // What confirm.html does: load by the link's day + submission_id, then post
  // back every displayed product with the (possibly edited) quantity.
  const openConfirmPage = (submissionId) =>
    b.get({ action: 'get_delivery', day: DAY, submission_id: submissionId });
  const confirm = (submissionId, products, full) =>
    b.post({
      action: 'confirm',
      day: DAY,
      submission_id: submissionId,
      full_confirmation: full,
      confirmed_products: products.map((p) => ({
        key: p.key,
        name: p.name,
        category: p.category,
        quantity: p.quantity,
      })),
    });
  const approveLatest = () => {
    const email = b.emails.filter((e) => /בקשת עדכון/.test(e.subject)).pop();
    const m = email.body.match(/approve\.html\?id=([^&\s]+)&token=([^&\s]+)/);
    return b.get({ action: 'approve_update', id: decodeURIComponent(m[1]), token: decodeURIComponent(m[2]) });
  };
  return { ...b, sheet, qty, status, openConfirmPage, confirm, approveLatest };
}

test('no update: full confirmation works and keeps quantities', () => {
  const t = setup();
  t.post(order('s1', [croissant(5), pecan(3)]));
  const page = t.openConfirmPage('s1');
  assert.equal(page.success, true);

  const res = t.confirm('s1', page.data.products, true);
  assert.equal(res.success, true);
  assert.equal(t.status(), 'confirmed');
  assert.equal(t.qty('sweet_croissant_butter'), 5);
  assert.equal(t.qty('sweet_pecan_pastry'), 3);
});

test('no update: confirmation with changes sets Shalev\'s quantity', () => {
  const t = setup();
  t.post(order('s1', [croissant(5), pecan(3)]));
  const page = t.openConfirmPage('s1');
  const edited = page.data.products.map((p) => (p.key === 'sweet_pecan_pastry' ? { ...p, quantity: 2 } : p));

  const res = t.confirm('s1', edited, false);
  assert.equal(res.success, true);
  assert.equal(t.status(), 'confirmed_with_changes');
  assert.equal(t.qty('sweet_pecan_pastry'), 2);
  assert.equal(t.qty('sweet_croissant_butter'), 5);
});

test('update still pending: original email link opens and confirms the original order', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  t.post(order('s2', [croissant(9)])); // second send → pending update, sheet untouched

  const page = t.openConfirmPage('s1');
  assert.equal(page.success, true, 'link from the first email is still valid');
  assert.equal(page.data.products.find((p) => p.key === 'sweet_croissant_butter').quantity, 5);

  assert.equal(t.confirm('s1', page.data.products, true).success, true);
  assert.equal(t.status(), 'confirmed');
  assert.equal(t.qty('sweet_croissant_butter'), 5, 'pending update not applied by confirming');
});

test('update approved BEFORE confirming: confirm page shows and keeps the new quantity', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  t.post(order('s2', [croissant(9)]));
  assert.equal(t.approveLatest().success, true);

  const page = t.openConfirmPage('s1');
  assert.equal(page.success, true);
  assert.equal(page.data.products.find((p) => p.key === 'sweet_croissant_butter').quantity, 9);

  assert.equal(t.confirm('s1', page.data.products, true).success, true);
  assert.equal(t.qty('sweet_croissant_butter'), 9);
});

test('update approved AFTER confirming: quantity replaced, re-confirming still works', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  t.confirm('s1', t.openConfirmPage('s1').data.products, true);

  t.post(order('s2', [croissant(9)]));
  assert.equal(t.approveLatest().success, true);
  assert.equal(t.qty('sweet_croissant_butter'), 9);
  assert.equal(t.status(), 'confirmed', 'earlier confirmation is kept');

  const page = t.openConfirmPage('s1');
  assert.equal(page.success, true);
  assert.equal(t.confirm('s1', page.data.products, true).success, true);
  assert.equal(t.qty('sweet_croissant_butter'), 9);
});

test('confirmation sent twice (retry) succeeds both times without changing quantities', () => {
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  const products = t.openConfirmPage('s1').data.products;
  assert.equal(t.confirm('s1', products, true).success, true);
  assert.equal(t.confirm('s1', products, true).success, true);
  assert.equal(t.qty('sweet_croissant_butter'), 5);
});

test('confirm page loaded before an approval is detected as stale by confirm.html', () => {
  // confirm.html compares the server quantities with the ones it displayed
  // before posting; here we assert the server side of that check.
  const t = setup();
  t.post(order('s1', [croissant(5)]));
  const before = t.openConfirmPage('s1').data.products;
  t.post(order('s2', [croissant(9)]));
  t.approveLatest();
  const now = t.openConfirmPage('s1').data.products;
  const qtyOf = (list) => list.find((p) => p.key === 'sweet_croissant_butter').quantity;
  assert.notEqual(qtyOf(before), qtyOf(now));
});
