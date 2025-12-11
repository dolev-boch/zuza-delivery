# Bug Fix: Custom Products Added from Confirmation Page Not Saved to Google Sheets

## Issue

When users add custom products from the confirmation page ([confirm.html](confirm.html)) using the new custom product feature, these products are displayed correctly in the UI but are **not being saved to Google Sheets** when the confirmation is submitted.

---

## Root Cause

The `updateCustomProductConfirmation()` function in [Code.gs](Code.gs#L664-L708) had logic to **update** existing custom products, but was missing logic to **create new rows** when a custom product doesn't exist yet.

### How Custom Products Work:

1. **Frontend**: User adds a custom product with key like `custom_productName`
2. **Frontend**: Product is added to `deliveryData.products` with category `אחרים`
3. **Frontend**: Product is displayed in confirmation UI
4. **Confirmation**: Product is sent to backend with `originalQuantity = 0` and `confirmedQuantity = 1+`
5. **Backend Issue**: `updateCustomProductConfirmation()` searches for the product name in rows 91+
   - If found → updates the quantity ✓
   - **If not found → does nothing ✗** (BUG!)

---

## Solution

### Backend Fix: [Code.gs](Code.gs#L664-L708)

Added an `else` block to create a new row when a custom product doesn't exist:

```javascript
function updateCustomProductConfirmation(sheet, product, currentTime, originalQuantity, confirmedQuantity) {
  const productName = product.name;
  const productCategory = product.category || 'אחרים';
  const lastRow = sheet.getLastRow();
  let foundRow = null;

  // Search for existing custom product
  for (let row = CUSTOM_PRODUCTS_START_ROW; row <= lastRow; row++) {
    const existingName = sheet.getRange(row, COLUMNS.PRODUCT_NAME).getValue();
    if (existingName === productName) {
      foundRow = row;
      break;
    }
  }

  if (foundRow) {
    // Update existing product
    sheet.getRange(foundRow, COLUMNS.QUANTITY).setValue(confirmedQuantity);
    // ... existing update logic ...
  } else {
    // ✅ NEW: Create new row for product added during confirmation
    const newRow = lastRow + 1;
    Logger.log(`Creating new custom product row ${newRow} for: ${productName}`);

    sheet.getRange(newRow, COLUMNS.PRODUCT_NAME).setValue(productName);
    sheet.getRange(newRow, COLUMNS.CATEGORY).setValue(productCategory);
    sheet.getRange(newRow, COLUMNS.QUANTITY).setValue(confirmedQuantity);
    sheet.getRange(newRow, COLUMNS.NOTES).setValue('נוסף באישור');
    sheet.getRange(newRow, COLUMNS.LAST_UPDATED).setValue(currentTime);

    // Highlight as new product added during confirmation
    if (confirmedQuantity > 0) {
      sheet.getRange(newRow, 1, 1, 5).setBackground('#fff3cd');
    }
  }
}
```

**Key Changes:**
1. Added `productCategory` variable to capture the category
2. Added `else` block (lines 692-707) to create new row if product not found
3. New row is created at `lastRow + 1` (dynamically grows the sheet)
4. Product is marked with note "נוסף באישור" (Added during confirmation)
5. Product is highlighted in yellow (`#fff3cd`) to indicate change

---

### Frontend Fix: [confirm.html](confirm.html)

#### Change 1: Add Category to Product Display Elements

**Lines 1541, 1152**: Added `data-product-category` attribute to quantity display elements:

```html
<!-- For newly added products -->
<div
  class="quantity-display changed"
  id="qty-${productKey}"
  data-original="0"
  data-product-key="${productKey}"
  data-product-name="${product.name}"
  data-product-category="${product.category}"  <!-- ✅ NEW -->
>${product.quantity}</div>

<!-- For regular products -->
<div
  class="quantity-display"
  id="qty-${product.key}"
  data-original="${product.quantity}"
  data-product-key="${product.key}"
  data-product-name="${product.name}"
  data-product-category="${product.category}"  <!-- ✅ NEW -->
>${product.quantity}</div>
```

#### Change 2: Include Category in Confirmation Submission

**Lines 1240-1248**: Updated confirmation submission to include category:

```javascript
const confirmedProducts = [];
document.querySelectorAll('.quantity-display').forEach((display) => {
  confirmedProducts.push({
    key: display.dataset.productKey,
    name: display.dataset.productName,
    category: display.dataset.productCategory,  // ✅ NEW
    quantity: parseInt(display.textContent) || 0,
  });
});
```

---

## How It Works Now

### Adding Custom Product Flow:

1. **User opens confirmation page** with existing delivery
2. **User clicks "הוספת מוצרים שנשכחו"** (Add forgotten products)
3. **User types custom product name** in the orange "הוספת מוצר חדש (אחרים)" section
4. **User clicks "הוסף +"**:
   - Product key generated: `custom_sanitizedProductName`
   - Product added to `addedProducts` with category `אחרים`
   - Product appears in "מוצרים שנוספו" section
5. **User clicks "שמור והוסף למשלוח"**:
   - Product added to main display with category `אחרים`
   - Product marked as "נוסף" (Added) in UI
   - Product added to `deliveryData.products` array
6. **User confirms delivery**:
   - Frontend sends: `{key: "custom_...", name: "...", category: "אחרים", quantity: 1}`
   - Backend detects `originalQuantity = 0`, `confirmedQuantity = 1` → CHANGE DETECTED
   - Backend calls `updateCustomProductConfirmation()`
   - **Backend creates new row** at row 91+ with:
     - Column A: Product name
     - Column B: Category (`אחרים`)
     - Column C: Quantity (1+)
     - Column D: Notes ("נוסף באישור")
     - Column E: Timestamp
   - Row highlighted in yellow (`#fff3cd`)
7. **Product saved to Google Sheets** ✓

---

## Files Modified

| File | Lines Changed | Description |
|------|---------------|-------------|
| [Code.gs](Code.gs#L664-L708) | 664-708 | Added `else` block to create new custom product rows |
| [confirm.html](confirm.html#L1152) | 1152 | Added category data attribute to regular product displays |
| [confirm.html](confirm.html#L1541) | 1541 | Added category data attribute to newly added product displays |
| [confirm.html](confirm.html#L1245) | 1245 | Included category in confirmation submission |

---

## Testing Checklist

### Test Custom Product Addition:
- [ ] Open existing delivery confirmation link
- [ ] Click "הוספת מוצרים שנשכחו"
- [ ] Type custom product name (e.g., "עוגיות שוקולד צ'יפ")
- [ ] Click "הוסף +"
- [ ] Verify product appears in "מוצרים שנוספו" section
- [ ] Click "שמור והוסף למשלוח"
- [ ] Verify product appears in main display under "אחרים" category
- [ ] Click "אישור עם שינויים"
- [ ] Check Google Sheets - verify new row created at row 91+ with:
  - Product name
  - Category "אחרים"
  - Quantity = 1
  - Notes = "נוסף באישור"
  - Yellow background

### Test Multiple Custom Products:
- [ ] Add 3 different custom products
- [ ] Modify quantities (e.g., 2, 3, 1)
- [ ] Confirm delivery
- [ ] Verify all 3 products saved to Google Sheets

### Test Custom Product Name Validation:
- [ ] Try adding product with empty name → should show alert
- [ ] Try adding same product twice → should show alert
- [ ] Try adding product that already exists in delivery → should show alert

### Edge Cases:
- [ ] Add custom product with Hebrew name
- [ ] Add custom product with English name
- [ ] Add custom product with numbers
- [ ] Add custom product with special characters (cleaned to `_`)
- [ ] Verify each saves correctly

---

## Deployment Requirements

**✅ YES - Apps Script Redeployment Required**

This is a backend logic change in Code.gs, so you must:

1. **Update Code.gs in Google Apps Script:**
   - Go to: https://script.google.com
   - Open your project
   - Replace Code.gs content with updated version
   - Save the file

2. **Create New Deployment:**
   - Click "Deploy" → "New deployment"
   - Or "Manage deployments" → "Edit" → "Version: New version"
   - Description: "Fixed custom products from confirmation page - now creates new rows"
   - Click "Deploy"
   - **Copy the new Web App URL**

3. **Update Frontend URL:**
   - [confirm.html:771](confirm.html#L771) - Update `SCRIPT_URL`
   - Replace with new deployment URL

4. **Deploy to Vercel:**
   - Push updated confirm.html to Vercel
   - Or redeploy if auto-deploy is enabled

---

## Impact Analysis

### What Changed:
- Custom products added during confirmation now **create new rows** in Google Sheets
- Category information is now included in confirmation submissions
- New products marked with "נוסף באישור" note

### What Didn't Change:
- Existing custom product update logic (still works)
- Regular product confirmation logic (unchanged)
- Full confirmation behavior (unchanged)
- Frontend UI (already implemented, just fixed backend)

### Performance:
- Minimal impact (one additional row write per new custom product)
- No additional API calls

---

## Backward Compatibility

✅ **Fully Compatible**

- Existing confirmations without custom products: unchanged
- Existing custom products (from initial submission): still updated correctly
- Only affects **new** custom products added during confirmation

---

## Related Features

This fix completes the custom product addition feature implemented in confirm.html:
1. ✅ **UI/UX**: Custom product input section (orange theme)
2. ✅ **Frontend Logic**: `addCustomProduct()` function
3. ✅ **Product Display**: Custom products shown in main display
4. ✅ **Confirmation Submission**: Category included in submission
5. ✅ **Backend Logic**: New row creation (this fix)

---

**Status:** ✅ Fixed
**Date:** December 11, 2024
**Severity:** High (custom products not saving)
**Deployment Required:** Yes
