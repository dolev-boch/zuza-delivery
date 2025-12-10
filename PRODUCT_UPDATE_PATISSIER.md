# Product Update: פטיסייר קינמון - December 10, 2024

## Summary

Updated Hanukkah product name from "פטיסייר" to "פטיסייר קינמון" and removed the separate "קינמון" product. Row 87 now contains the correct combined name.

---

## Changes Made

### 1. ✅ [Code.gs](Code.gs#L1334-L1343) - Backend Product Mapping

**Line 1334:** Updated comment
```javascript
// OLD: // HANUKKAH 2025 DONUTS - Rows 80-89 (10 products) - Sheets 10-31 only
// NEW: // HANUKKAH 2025 DONUTS - Rows 80-89 (9 products) - Sheets 10-31 only
```

**Line 1342:** Updated product name
```javascript
// OLD: 'hanukkah_patissier': { row: 87, name: 'פטיסייר', category: 'סופגניות חנוכה 2025', price: 15 },
// NEW: 'hanukkah_patissier': { row: 87, name: 'פטיסייר קינמון', category: 'סופגניות חנוכה 2025', price: 15 },
```

**Line 1343:** Removed separate קינמון entry
```javascript
// REMOVED: 'hanukkah_cinnamon': { row: 88, name: 'קינמון', category: 'סופגניות חנוכה 2025', price: 15 },
```

**Result:** Now 9 Hanukkah products instead of 10.

---

### 2. ✅ [index.html](index.html#L970-L979) - Main Form

**Lines 978-979:** Updated PRODUCT_KEYS mapping
```javascript
// OLD:
פטיסייר: 'hanukkah_patissier',
קינמון: 'hanukkah_cinnamon',

// NEW:
'פטיסייר קינמון': 'hanukkah_patissier',
// קינמון line removed
```

**Lines 1088-1089:** Updated CATEGORIES array
```javascript
// OLD:
'פטיסייר',
'קינמון',
'סנט הונורה',

// NEW:
'פטיסייר קינמון',
'סנט הונורה',
```

---

### 3. ✅ [confirm.html](confirm.html#L735-L744) - Confirmation Page

**Lines 743-744:** Updated PRODUCT_KEYS mapping
```javascript
// OLD:
פטיסייר: 'hanukkah_patissier',
קינמון: 'hanukkah_cinnamon',

// NEW:
'פטיסייר קינמון': 'hanukkah_patissier',
// קינמון line removed
```

**Lines 845-846:** Updated CATEGORIES array
```javascript
// OLD:
'פטיסייר',
'קינמון',
'סנט הונורה',

// NEW:
'פטיסייר קינמון',
'סנט הונורה',
```

---

### 4. ✅ [AddHanukkahProducts.gs](AddHanukkahProducts.gs#L23-L33) - Utility Script

**Lines 31-32:** Updated product definition
```javascript
// OLD:
{ row: 87, name: 'פטיסייר', category: 'סופגניות חנוכה 2025', price: 15 },
{ row: 88, name: 'קינמון', category: 'סופגניות חנוכה 2025', price: 15 },
{ row: 89, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 }

// NEW:
{ row: 87, name: 'פטיסייר קינמון', category: 'סופגניות חנוכה 2025', price: 15 },
{ row: 89, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 }
```

**Note:** Row 88 is now skipped (will remain empty in sheets).

---

## Deployment Requirements

### ✅ **YES - Apps Script Redeployment Required**

You **MUST** redeploy Code.gs and update the URL because:

1. **Backend Logic Changed:** The PRODUCT_ROW_MAP in Code.gs has been modified
2. **Product Key Removed:** The `hanukkah_cinnamon` key no longer exists
3. **Product Name Changed:** Row 87 now expects "פטיסייר קינמון" instead of "פטיסייר"

**Deployment Steps:**

1. **Update Code.gs in Google Apps Script:**
   - Go to: https://script.google.com
   - Open your project
   - Replace Code.gs content with the updated version
   - Save the file

2. **Create New Deployment:**
   - Click "Deploy" → "New deployment"
   - Or "Manage deployments" → "Edit" (pencil icon) → "Version: New version"
   - Add description: "Updated פטיסייר to פטיסייר קינמון, removed separate קינמון product"
   - Click "Deploy"
   - Copy the new Web App URL

3. **Update Frontend URLs:**
   - [index.html:971](index.html#L971) - Update `API_URL`
   - [confirm.html:515](confirm.html#L515) - Update `SCRIPT_URL`
   - Replace old URL with new deployment URL

4. **Deploy to Vercel:**
   - Push updated index.html and confirm.html to Vercel
   - Or redeploy if auto-deploy is enabled

---

## Manual Google Sheets Update

Since you mentioned you'll manually adjust row 87 in Google Sheets:

### What You Need to Do:

1. **Open Google Spreadsheet**
2. **For Each Sheet 11-32 (indices 10-31):**
   - Go to **Row 87, Column A**
   - Change "פטיסייר" to **"פטיסייר קינמון"**
   - **Row 88** can be left empty or cleared (it's no longer used)
   - **Row 89** should remain "סנט הונורה" (unchanged)

3. **Summary Sheet (סיכום חודש):**
   - If Hanukkah products are listed there (rows 81-90)
   - Update row 87 to "פטיסייר קינמון"
   - Remove or clear row 88 if it exists

### Why Row 88 is Skipped:

- Row 87: **פטיסייר קינמון** (combined product)
- Row 88: **Empty** (no longer used)
- Row 89: **סנט הונורה** (unchanged)

This maintains the original row structure while removing the duplicate product.

---

## Impact Analysis

### What Changed:

1. **Product Count:** 10 → 9 Hanukkah products
2. **Row 87:** Now contains "פטיסייר קינמון" (full name)
3. **Row 88:** Empty/unused (previously "קינמון")
4. **Product Key:** `hanukkah_cinnamon` removed entirely

### What Didn't Change:

1. **Row Numbers:** All other products remain in same rows
2. **Product Keys:** All other keys unchanged (`hanukkah_patissier` still maps to row 87)
3. **Prices:** All prices unchanged
4. **Sheet Range:** Still sheets 10-31 for Hanukkah products
5. **Backend Logic:** Sheet detection and product processing logic unchanged

### Backward Compatibility:

⚠️ **Breaking Change for Old Data:**
- Old submissions with separate "פטיסייר" and "קינמון" entries won't match the new structure
- However, since you're manually updating the sheets, this is acceptable

✅ **Safe for New Submissions:**
- All new form submissions will use "פטיסייר קינמון"
- No confusion between two separate products

---

## Testing Checklist

### After Deployment:

- [ ] **Test Form Submission (index.html):**
  - Open form in browser
  - Navigate to "סופגניות חנוכה 2025" category
  - Verify "פטיסייר קינמון" appears (NOT "פטיסייר" and "קינמון" separately)
  - Submit a test delivery to sheet "11" or "15"
  - Check that row 87 receives the quantity

- [ ] **Test Confirmation (confirm.html):**
  - Open confirmation link from email
  - Verify "פטיסייר קינמון" displays correctly
  - Test quantity modification
  - Confirm delivery and check sheet

- [ ] **Verify Google Sheets:**
  - Check row 87 in sheets 11-32
  - Should show "פטיסייר קינמון" with correct quantities
  - Row 88 should be empty
  - Row 89 should show "סנט הונורה"

- [ ] **Test Summary Sheet Update:**
  - Run manual summary update via menu
  - Check that "פטיסייר קינמון" appears correctly
  - Verify quantities are consolidated properly

---

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| [Code.gs](Code.gs) | 1334, 1342-1343 | Backend product mapping |
| [index.html](index.html) | 978-979, 1088-1089 | Main form product keys and categories |
| [confirm.html](confirm.html) | 743-744, 845-846 | Confirmation page product keys and categories |
| [AddHanukkahProducts.gs](AddHanukkahProducts.gs) | 31-32 | Utility script for bulk updates |

---

## Important Notes

1. **Consistent Naming:** The product key `hanukkah_patissier` now maps to "פטיסייר קינמון"
2. **Row 88 Gap:** This is intentional and safe - the system will simply skip row 88
3. **Manual Update:** Remember to manually update row 87 in all relevant sheets
4. **No Old Data Migration:** If old sheets have separate "פטיסייר" and "קינמון" entries, they'll need manual consolidation

---

**Status:** ✅ All Files Updated
**Deployment Required:** ✅ YES - Apps Script + Frontend
**Date:** December 10, 2024
