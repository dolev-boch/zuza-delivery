const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOrderCopyFields, sendOrderCopyEmail } = require('../order-update.js');

const order = (id, extra = {}) => ({
  submission_id: id,
  delivery_date: '24/10/2026',
  certificate_number: '77',
  filler_name: 'אדל',
  products: [
    { key: 'sweet_brioche_sugar', name: 'בריוש סוכרה', category: 'מאפים מתוקים', quantity: '3', notes: '' },
    { key: 'sandwiches_challah', name: 'כריך חלה וקציצות', category: 'כריכים', quantity: '5', notes: 'בדיקה' },
    { key: 'custom_1', name: 'בדיקה', category: 'אחרים', quantity: '10', notes: '' },
  ],
  ...extra,
});

test('email holds exactly the form data', () => {
  const f = buildOrderCopyFields(order('a'));
  assert.equal(f._subject, 'הזמנה מטופס זוזה - 24/10/2026 - אדל');
  assert.equal(f['תאריך משלוח'], '24/10/2026');
  assert.equal(f['ממלא התעודה'], 'אדל');
  assert.equal(f['מספר תעודה'], '77');
  assert.equal(f['סוג שליחה'], 'הזמנה');
  assert.equal(f['מספר מוצרים'], '3');
  assert.equal(f['סה"כ יחידות'], '18');
  assert.equal(
    f['מוצרים'],
    [
      '1. בריוש סוכרה (מאפים מתוקים): 3',
      '2. כריך חלה וקציצות (כריכים): 5 — הערה: בדיקה',
      '3. בדיקה (אחרים): 10',
    ].join('\n')
  );
  assert.equal(buildOrderCopyFields(order('b', { action: 'update_request' }))['סוג שליחה'], 'עדכון להזמנה קיימת');
});

test('sent straight to FormSubmit for dolev.boch@gmail.com, once per submission', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => (calls.push({ url, opts }), { ok: true });
  assert.equal(await sendOrderCopyEmail(order('once'), { fetchImpl }), true);
  assert.equal(await sendOrderCopyEmail(order('once'), { fetchImpl }), false, 'retry of same order not re-sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://formsubmit.co/ajax/dolev.boch@gmail.com');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(JSON.parse(calls[0].opts.body)['תאריך משלוח'], '24/10/2026');
});

test('a failing or unreachable email service never throws', async () => {
  const down = async () => {
    throw new TypeError('Failed to fetch');
  };
  assert.equal(await sendOrderCopyEmail(order('down'), { fetchImpl: down }), false);
  const error500 = async () => ({ ok: false });
  assert.equal(await sendOrderCopyEmail(order('err'), { fetchImpl: error500 }), false);
});
