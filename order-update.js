// Shared helpers for the "order already exists for this day" flow and for
// talking to the Apps Script API. Loaded by index.html / confirm.html /
// approve.html, and required by the Node tests.
(function (root) {
  const SHALEV_WHATSAPP_NUMBER = '972526713226';

  function buildWhatsAppMessage(deliveryDate, products) {
    const lines = [`היי שליו, זה עדכון להזמנה של היום ${deliveryDate}`];
    products.forEach((p, i) => {
      lines.push(
        `${i + 1}. המוצר: ${p.name}, כמות מעודכנת שמחליפה את הכמות הנוכחית: ${parseInt(p.quantity, 10) || 0}.`
      );
    });
    lines.push('הודעת מערכת: שליו, בדוק את המייל שלך כדי לאשר את השינויים בפועל בקובץ.');
    return lines.join('\n');
  }

  function buildWhatsAppUrl(deliveryDate, products, number) {
    const text = buildWhatsAppMessage(deliveryDate, products);
    return `https://wa.me/${number || SHALEV_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * GET returning JSON, retried on network errors and non-2xx responses
   * (Apps Script intermittently answers 404/5xx on its redirect hop).
   */
  async function fetchJsonWithRetry(url, { attempts = 3, delayMs = 1500, fetchImpl } = {}) {
    const doFetch = fetchImpl || root.fetch.bind(root);
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await doFetch(url, { method: 'GET', redirect: 'follow' });
        if (!response.ok) throw new Error(`שגיאת שרת: ${response.status}`);
        return await response.json();
      } catch (err) {
        lastError = err;
        if (i < attempts - 1) await sleep(delayMs * (i + 1));
      }
    }
    throw lastError;
  }

  /**
   * POST whose JSON response can be read. text/plain keeps it a "simple"
   * request (no CORS preflight, which Apps Script doesn't answer); doPost
   * still parses e.postData.contents as JSON.
   */
  async function postJson(url, payload, { timeoutMs = 60000, fetchImpl } = {}) {
    const doFetch = fetchImpl || root.fetch.bind(root);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller ? controller.signal : undefined,
      });
      if (!response.ok) throw new Error(`שגיאת שרת: ${response.status}`);
      return await response.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  const api = {
    SHALEV_WHATSAPP_NUMBER,
    buildWhatsAppMessage,
    buildWhatsAppUrl,
    fetchJsonWithRetry,
    postJson,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZuzaOrderUpdate = api;
})(typeof window !== 'undefined' ? window : globalThis);
