// Minimal in-memory fakes of the Apps Script services used by Code.gs and
// OrderUpdates.gs, so the backend can run under Node.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  forEach(fn) {
    for (let r = 0; r < this.numRows; r++)
      for (let c = 0; c < this.numCols; c++) fn(this.row + r, this.col + c, r, c);
  }
  getValues() {
    const out = Array.from({ length: this.numRows }, () => Array(this.numCols).fill(''));
    this.forEach((R, C, r, c) => (out[r][c] = this.sheet.get(R, C)));
    return out;
  }
  getValue() {
    return this.sheet.get(this.row, this.col);
  }
  setValues(values) {
    this.forEach((R, C, r, c) => this.sheet.set(R, C, values[r][c]));
    return this;
  }
  setValue(v) {
    this.forEach((R, C) => this.sheet.set(R, C, v));
    return this;
  }
  clearContent() {
    this.forEach((R, C) => this.sheet.set(R, C, ''));
    return this;
  }
  setBackground(color) {
    this.forEach((R, C) => (this.sheet.backgrounds[`${R},${C}`] = color));
    return this;
  }
  setNumberFormat() {
    return this;
  }
  setFontWeight() {
    return this;
  }
}

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.cells = {};
    this.backgrounds = {};
  }
  getName() {
    return this.name;
  }
  get(r, c) {
    const v = this.cells[`${r},${c}`];
    return v === undefined ? '' : v;
  }
  set(r, c, v) {
    this.cells[`${r},${c}`] = v;
  }
  getRange(row, col, numRows, numCols) {
    return new FakeRange(this, row, col, numRows, numCols);
  }
  getLastRow() {
    let last = 0;
    Object.entries(this.cells).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) last = Math.max(last, Number(k.split(',')[0]));
    });
    return last;
  }
  getLastColumn() {
    return 11;
  }
  setFrozenRows() {}
}

class FakeSpreadsheet {
  constructor() {
    this.sheets = {};
  }
  getSheetByName(name) {
    return this.sheets[name] || null;
  }
  insertSheet(name) {
    return (this.sheets[name] = new FakeSheet(name));
  }
  getSheets() {
    return Object.values(this.sheets);
  }
}

function loadBackend() {
  const ss = new FakeSpreadsheet();
  const emails = [];
  const cache = {};
  let uuid = 0;

  const context = {
    console,
    Intl,
    Date,
    JSON,
    Math,
    Logger: { log() {} },
    SpreadsheetApp: { openById: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => (cache[k] = v),
      }),
    },
    GmailApp: { sendEmail: (to, subject, body, opts) => emails.push({ to, subject, body, opts }) },
    MailApp: { sendEmail: (o) => emails.push(o) },
    Utilities: {
      getUuid: () => `00000000-0000-0000-0000-${String(++uuid).padStart(12, '0')}`,
      sleep() {},
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (content) => ({ content, setMimeType() { return this; } }),
    },
  };
  vm.createContext(context);

  const root = path.join(__dirname, '..');
  const source =
    fs.readFileSync(path.join(root, 'Code.gs'), 'utf8') +
    '\n' +
    fs.readFileSync(path.join(root, 'OrderUpdates.gs'), 'utf8') +
    '\n;({ PRODUCT_ROW_MAP, COLUMNS, UPDATES_SHEET_NAME, CUSTOM_PRODUCTS_START_ROW,' +
    ' dayHasExistingOrder, findProductRow });';
  const exported = vm.runInContext(source, context);

  // Day sheet with every regular product name at its mapped row
  function addDaySheet(name) {
    const sheet = ss.insertSheet(name);
    Object.values(exported.PRODUCT_ROW_MAP).forEach((info) => {
      sheet.set(info.row, 1, info.name);
      sheet.set(info.row, 2, info.category);
    });
    return sheet;
  }

  const parse = (out) => JSON.parse(out.content);
  const post = (payload) => parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }));
  const get = (parameter) => parse(context.doGet({ parameter }));

  return { ss, emails, context, exported, addDaySheet, post, get };
}

module.exports = { loadBackend, FakeSheet };
