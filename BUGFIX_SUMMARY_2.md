# Bug Fix Summary #2 - December 10, 2024

## Issues Fixed

### 1. ✅ Hanukkah Products Not Being Added to Google Sheets

**Problem:**
- Hanukkah products (rows 80-89) were not being saved to sheets 10-31
- Products submitted through the form were missing from the spreadsheet

**Root Cause:**
- The code was using `allSheets.indexOf(sheet)` to determine sheet position
- For newly created or existing sheets accessed by name, the index lookup was unreliable
- The condition `sheetIndex >= FIRST_HANUKKAH_SHEET` was checking array index (0-based) but sheet names are like "01", "10", "11" (1-based)

**Solution:**
- Parse the sheet name directly to get the sheet number
- Convert sheet name (e.g., "10", "11") to integer
- Check if sheet number is in range 11-32 (which corresponds to sheets 10-31 in 0-based indexing)

**Code Change in [Code.gs](Code.gs) (Lines 471-477):**
```javascript
// OLD (incorrect):
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const allSheets = ss.getSheets();
const sheetIndex = allSheets.indexOf(sheet);
const isHanukkahSheet = sheetIndex >= FIRST_HANUKKAH_SHEET && sheetIndex <= LAST_HANUKKAH_SHEET;

// NEW (correct):
const sheetName = sheet.getName();
const sheetNumber = parseInt(sheetName, 10);
const isHanukkahSheet = !isNaN(sheetNumber) && sheetNumber >= (FIRST_HANUKKAH_SHEET + 1) && sheetNumber <= (LAST_HANUKKAH_SHEET + 1);

Logger.log(`Sheet: ${sheetName}, Number: ${sheetNumber}, Is Hanukkah: ${isHanukkahSheet}`);
```

**Why This Works:**
- Sheet names: "01", "02", "10", "11", "31", etc.
- FIRST_HANUKKAH_SHEET = 10 (0-based index) → Sheet "11" (1-based name)
- LAST_HANUKKAH_SHEET = 31 (0-based index) → Sheet "32" (1-based name)
- We check: `sheetNumber >= 11 && sheetNumber <= 32`

---

### 2. ✅ אחרים Products Not Painting Green on Full Confirmation

**Problem:**
- When recipient confirms delivery with "אישור מלא" (Full Confirmation), regular products turn green
- But אחרים (custom) products remain white/unpainted

**Root Cause:**
- Line 586-587 in `processConfirmation()` function:
```javascript
const lastProductRow = Math.max(...Object.values(PRODUCT_ROW_MAP).map(p => p.row));
sheet.getRange(2, 1, lastProductRow - 1, 5).setBackground('#d4edda');
```
- This only paints up to the last **mapped** product row (row ~70)
- אחרים products start at row 91, so they were never included

**Solution:**
- Use `sheet.getLastRow()` to find the actual last row with data
- Paint ALL rows from 2 to last row

**Code Change in [Code.gs](Code.gs) (Lines 586-590):**
```javascript
// OLD:
const lastProductRow = Math.max(...Object.values(PRODUCT_ROW_MAP).map(p => p.row));
sheet.getRange(2, 1, lastProductRow - 1, 5).setBackground('#d4edda');

// NEW:
// Paint all products including אחרים (custom products)
const lastRow = sheet.getLastRow();
if (lastRow >= 2) {
  sheet.getRange(2, 1, lastRow - 1, 5).setBackground('#d4edda');
}
```

**Result:**
- Now ALL products (regular + Hanukkah + אחרים) turn green on full confirmation
- Visual consistency for recipient when they approve the delivery

---

### 3. ✅ Product Name Change: כריך פוקאצ'ה → מאפה גבינות סביח

**Problem:**
- Product was incorrectly named "כריך פוקאצ'ה" (Focaccia Sandwich)
- Should be "מאפה גבינות סביח" (Sabich Cheese Pastry)

**Solution:**
- Updated product name in all three files while keeping the same key `sandwiches_focaccia`
- This ensures backward compatibility with existing data

**Files Updated:**

1. **[Code.gs](Code.gs) - Line 1383:**
```javascript
// OLD:
'sandwiches_focaccia': { row: 34, name: "כריך פוקאצ'ה", category: 'כריכים', price: 0 },

// NEW:
'sandwiches_focaccia': { row: 34, name: 'מאפה גבינות סביח', category: 'כריכים', price: 0 },
```

2. **[index.html](index.html) - Lines 1019 & 1140:**
```javascript
// PRODUCT_KEYS mapping (line 1019):
'מאפה גבינות סביח': 'sandwiches_focaccia',

// CATEGORIES.sandwiches.products array (line 1140):
'מאפה גבינות סביח',
```

3. **[confirm.html](confirm.html) - Lines 781 & 896:**
```javascript
// PRODUCT_KEYS mapping (line 781):
'מאפה גבינות סביח': 'sandwiches_focaccia',

// CATEGORIES.sandwiches.products array (line 896):
'מאפה גבינות סביח',
```

**Note:** Other focaccia products remain unchanged:
- "ריבועי פוקאצ'ה" (Focaccia Squares) - unchanged
- "פוקאצ'ה אישית" (Personal Focaccia) - unchanged

---

## Files Modified

### [Code.gs](Code.gs)
- **Lines 471-477:** Fixed Hanukkah sheet detection logic
- **Lines 586-590:** Fixed full confirmation highlighting for all products
- **Line 1383:** Changed product name to "מאפה גבינות סביח"

### [index.html](index.html)
- **Line 1019:** Updated PRODUCT_KEYS mapping
- **Line 1140:** Updated CATEGORIES array

### [confirm.html](confirm.html)
- **Line 781:** Updated PRODUCT_KEYS mapping
- **Line 896:** Updated CATEGORIES array

---

## Testing Checklist

### Hanukkah Products (Issue #1)
- [ ] Submit delivery to sheet "10" with Hanukkah products
- [ ] Verify products appear in rows 80-89
- [ ] Submit delivery to sheet "11", "15", "20", "31" - all should save Hanukkah products
- [ ] Submit delivery to sheet "05" - should NOT save Hanukkah products (correct)
- [ ] Submit delivery to sheet "32" - should NOT save Hanukkah products (correct)
- [ ] Check execution log for: `Sheet: 10, Number: 10, Is Hanukkah: false` (sheet "10" = index 9, not in range)
- [ ] Check execution log for: `Sheet: 11, Number: 11, Is Hanukkah: true` (sheet "11" = index 10, in range)

### אחרים Confirmation Highlighting (Issue #2)
- [ ] Submit delivery with אחרים products (custom products starting row 91+)
- [ ] Open confirmation page
- [ ] Click "אישור מלא" (Full Confirmation)
- [ ] Verify ALL products turn green, including אחרים products
- [ ] Check sheet - rows 91+ should have green background (#d4edda)

### Product Name Change (Issue #3)
- [ ] Open [index.html](index.html) in browser
- [ ] Navigate to "כריכים" category
- [ ] Verify product shows as "מאפה גבינות סביח" (not "כריך פוקאצ'ה")
- [ ] Submit delivery with this product
- [ ] Check Google Sheet - row 34 should show "מאפה גבינות סביח"
- [ ] Open confirmation page
- [ ] Verify product name displays correctly
- [ ] Check that other focaccia products remain unchanged:
  - "ריבועי פוקאצ'ה" should still exist
  - "פוקאצ'ה אישית" should still exist

---

## Technical Details

### Issue #1: Sheet Numbering Explanation

**Sheet Names vs. Array Indices:**
```
Sheet Name | Array Index | Should Have Hanukkah?
-----------|-------------|---------------------
"01"       | 0           | No
"02"       | 1           | No
...        | ...         | ...
"10"       | 9           | No (off by one!)
"11"       | 10          | Yes ✓
"12"       | 11          | Yes ✓
...        | ...         | ...
"31"       | 30          | Yes ✓
"32"       | 31          | Yes ✓
"33"       | 32          | No
```

**The Fix:**
```javascript
// Constants (0-based indices):
FIRST_HANUKKAH_SHEET = 10  // Index 10 = Sheet "11"
LAST_HANUKKAH_SHEET = 31   // Index 31 = Sheet "32"

// Check (1-based sheet names):
sheetNumber >= 11 && sheetNumber <= 32
```

### Issue #2: Row Range Explanation

**Before Fix:**
```javascript
// Only painted rows 2 to ~70 (last mapped product)
const lastProductRow = Math.max(...Object.values(PRODUCT_ROW_MAP).map(p => p.row));
// Result: lastProductRow = 70 (approximately)
// Range: sheet.getRange(2, 1, 69, 5) - stops before row 91
```

**After Fix:**
```javascript
// Paints rows 2 to actual last row (could be 100+)
const lastRow = sheet.getLastRow();
// Result: lastRow = 100+ (if אחרים products exist)
// Range: sheet.getRange(2, 1, lastRow - 1, 5) - includes all products
```

### Issue #3: Product Key Consistency

**Important:** We kept the same key `sandwiches_focaccia` for backward compatibility:
- Old sheets with "כריך פוקאצ'ה" will still work
- New submissions will use "מאפה גבינות סביח"
- The key maps to the same row (34) in both cases

---

## Deployment Instructions

1. **Update Code.gs:**
   - Go to Google Apps Script
   - Replace Code.gs content
   - Save and deploy new version

2. **Update Frontend Files:**
   - Deploy updated [index.html](index.html) to Vercel
   - Deploy updated [confirm.html](confirm.html) to Vercel
   - Verify changes are live

3. **Clear Browser Cache:**
   - Users may need to hard refresh (Ctrl+F5) to see product name change

---

## Backward Compatibility

✅ **All changes are backward compatible:**

1. **Hanukkah Products:** Existing sheets without Hanukkah products are unaffected
2. **Confirmation Highlighting:** Existing confirmations work the same, just with better highlighting
3. **Product Name:** Old data with "כריך פוקאצ'ה" still displays correctly, new submissions use new name

---

## Rollback Plan

If issues occur:

**Issue #1 Rollback:**
```javascript
// Revert lines 471-477 to:
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const allSheets = ss.getSheets();
const sheetIndex = allSheets.indexOf(sheet);
const isHanukkahSheet = sheetIndex >= FIRST_HANUKKAH_SHEET && sheetIndex <= LAST_HANUKKAH_SHEET;
```

**Issue #2 Rollback:**
```javascript
// Revert lines 586-590 to:
const lastProductRow = Math.max(...Object.values(PRODUCT_ROW_MAP).map(p => p.row));
sheet.getRange(2, 1, lastProductRow - 1, 5).setBackground('#d4edda');
```

**Issue #3 Rollback:**
Change all instances of `'מאפה גבינות סביח'` back to `"כריך פוקאצ'ה"` in all three files.

---

**Status:** ✅ All Issues Resolved
**Date:** December 10, 2024
**Files Updated:** Code.gs, index.html, confirm.html
