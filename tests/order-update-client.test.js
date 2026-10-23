const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  fetchJsonWithRetry,
  postJson,
  SHALEV_WHATSAPP_NUMBER,
} = require('../order-update.js');

const products = [
  { name: 'קרואסון חמאה', quantity: '8' },
  { name: "פאדג' שוקולד", quantity: 2 },
];

test('WhatsApp message follows the requested Hebrew format', () => {
  assert.equal(
    buildWhatsAppMessage('05/10/2026', products),
    [
      'היי שליו, זה עדכון להזמנה של היום 05/10/2026',
      '1. המוצר: קרואסון חמאה, כמות מעודכנת שמחליפה את הכמות הנוכחית: 8.',
      "2. המוצר: פאדג' שוקולד, כמות מעודכנת שמחליפה את הכמות הנוכחית: 2.",
      'הודעת מערכת: שליו, בדוק את המייל שלך כדי לאשר את השינויים בפועל בקובץ.',
    ].join('\n')
  );
});

test('WhatsApp link targets Shalev and round-trips the message', () => {
  const url = new URL(buildWhatsAppUrl('05/10/2026', products));
  assert.equal(SHALEV_WHATSAPP_NUMBER, '972526713226');
  assert.equal(url.origin + url.pathname, 'https://wa.me/972526713226');
  assert.equal(url.searchParams.get('text'), buildWhatsAppMessage('05/10/2026', products));
});

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('fetchJsonWithRetry survives an intermittent 404', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return calls.length === 1 ? response(404, null) : response(200, { success: true });
  };
  const result = await fetchJsonWithRetry('https://x/y', { fetchImpl, delayMs: 1 });
  assert.deepEqual(result, { success: true });
  assert.equal(calls.length, 2);
});

test('fetchJsonWithRetry gives up after the last attempt', async () => {
  const fetchImpl = async () => response(404, null);
  await assert.rejects(fetchJsonWithRetry('https://x/y', { fetchImpl, attempts: 2, delayMs: 1 }), /404/);
});

test('postJson sends a CORS-simple text/plain body and returns the parsed answer', async () => {
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = opts;
    return response(200, { success: true, mode: 'update_request' });
  };
  const result = await postJson('https://x/y', { a: 1 }, { fetchImpl });
  assert.equal(result.mode, 'update_request');
  assert.equal(seen.method, 'POST');
  assert.match(seen.headers['Content-Type'], /^text\/plain/);
  assert.equal(seen.mode, undefined, 'not no-cors, so the response is readable');
  assert.deepEqual(JSON.parse(seen.body), { a: 1 });
});
