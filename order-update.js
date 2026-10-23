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

  // One GET with its own time limit; a stalled connection becomes an error
  // instead of hanging forever.
  async function getJsonOnce(doFetch, url, timeoutMs, cancelSignals) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller && controller.abort(), timeoutMs);
    if (controller) cancelSignals.push(controller);
    try {
      const response = await doFetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller ? controller.signal : undefined,
      });
      if (!response.ok) throw new Error(`שגיאת שרת: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error('תם הזמן לתגובה מהשרת');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Resolves with the first success; rejects only when every promise failed.
  function firstSuccess(promises) {
    return new Promise((resolve, reject) => {
      let failed = 0;
      let lastError;
      promises.forEach((p) =>
        p.then(resolve, (err) => {
          lastError = err;
          if (++failed === promises.length) reject(lastError);
        })
      );
    });
  }

  /**
   * Robust GET returning JSON, for a slow and occasionally flaky backend
   * (Apps Script: multi-second cold starts, intermittent 404/5xx on its
   * redirect hop):
   *  - every request has a time limit (timeoutMs), so nothing hangs;
   *  - hedging: if no answer after hedgeAfterMs, an identical second request
   *    races the first and the first success wins (reads only — pass
   *    hedge:false for anything that changes data);
   *  - exponential backoff with jitter between attempts;
   *  - onRetry(attemptNumber, attempts, error) lets the page show progress.
   * The server's JSON is returned even when it says success:false — only
   * transport failures are retried.
   */
  async function fetchJsonWithRetry(
    url,
    {
      attempts = 5,
      timeoutMs = 15000,
      hedge = true,
      hedgeAfterMs = 4000,
      delayMs = 1000,
      maxDelayMs = 8000,
      onRetry,
      fetchImpl,
    } = {}
  ) {
    const doFetch = fetchImpl || root.fetch.bind(root);
    let lastError;
    for (let i = 0; i < attempts; i++) {
      const controllers = [];
      try {
        const primary = getJsonOnce(doFetch, url, timeoutMs, controllers);
        let hedgeTimer;
        const racers = [primary];
        if (hedge) {
          racers.push(
            new Promise((resolve, reject) => {
              let started = false;
              const launch = () => {
                if (started) return;
                started = true;
                clearTimeout(hedgeTimer);
                getJsonOnce(doFetch, url, timeoutMs, controllers).then(resolve, reject);
              };
              hedgeTimer = setTimeout(launch, hedgeAfterMs);
              // Primary answered: no hedge needed. Primary failed fast (e.g. an
              // instant 404): start the second request now instead of waiting.
              primary.then(() => clearTimeout(hedgeTimer), launch);
            })
          );
        }
        const result = await firstSuccess(racers);
        clearTimeout(hedgeTimer);
        return result;
      } catch (err) {
        lastError = err;
        if (i < attempts - 1) {
          if (onRetry) onRetry(i + 2, attempts, err);
          const backoff = Math.min(delayMs * 2 ** i, maxDelayMs);
          await sleep(backoff / 2 + Math.random() * (backoff / 2));
        }
      } finally {
        controllers.forEach((c) => c.abort()); // cancel the losing request
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

  // --------------------------------------------------------------------------
  // Order copy by email — independent of Google Sheets / Apps Script.
  // The form data is sent straight from the browser to FormSubmit (free, no
  // account), which emails it. Fire-and-forget: it never blocks or fails the
  // real submission, and each submission_id is emailed at most once.
  // --------------------------------------------------------------------------
  const ORDER_COPY_ENDPOINT = 'https://formsubmit.co/ajax/dolev.boch@gmail.com';
  const emailedSubmissions = new Set();

  function buildOrderCopyFields(data) {
    const products = data.products || [];
    const lines = products.map((p, i) => {
      const notes = p.notes ? ` — הערה: ${p.notes}` : '';
      return `${i + 1}. ${p.name} (${p.category}): ${parseInt(p.quantity, 10) || 0}${notes}`;
    });
    const totalUnits = products.reduce((sum, p) => sum + (parseInt(p.quantity, 10) || 0), 0);
    return {
      _subject: `הזמנה מטופס זוזה - ${data.delivery_date}${data.filler_name ? ' - ' + data.filler_name : ''}`,
      _template: 'table',
      _captcha: 'false',
      'תאריך משלוח': data.delivery_date || '',
      'ממלא התעודה': data.filler_name || '',
      'מספר תעודה': data.certificate_number || '',
      'סוג שליחה': data.action === 'update_request' ? 'עדכון להזמנה קיימת' : 'הזמנה',
      'מספר מוצרים': String(products.length),
      'סה"כ יחידות': String(totalUnits),
      'מוצרים': lines.join('\n'),
      'מזהה שליחה': data.submission_id || '',
    };
  }

  function sendOrderCopyEmail(data, { fetchImpl, timeoutMs = 15000 } = {}) {
    if (!data || !data.submission_id || emailedSubmissions.has(data.submission_id)) {
      return Promise.resolve(false);
    }
    emailedSubmissions.add(data.submission_id);
    const doFetch = fetchImpl || root.fetch.bind(root);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller && controller.abort(), timeoutMs);
    return doFetch(ORDER_COPY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(buildOrderCopyFields(data)),
      keepalive: true, // finishes even if the page is closed right after sending
      signal: controller ? controller.signal : undefined,
    })
      .then((response) => response.ok)
      .catch((err) => {
        console.warn('Order copy email failed (order itself is unaffected):', err);
        return false;
      })
      .finally(() => clearTimeout(timeoutId));
  }

  const api = {
    buildOrderCopyFields,
    sendOrderCopyEmail,
    SHALEV_WHATSAPP_NUMBER,
    buildWhatsAppMessage,
    buildWhatsAppUrl,
    fetchJsonWithRetry,
    postJson,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZuzaOrderUpdate = api;
})(typeof window !== 'undefined' ? window : globalThis);
