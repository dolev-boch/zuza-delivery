# Bug Fix: סנט הונורה Creating Duplicates - December 10, 2024

## Issue

"סנט הונורה" (Saint Honoré) was being sent to row 89 in the code, but was manually placed in row 88 in Google Sheets. This caused the system to create duplicates:
- Row 88: "סנט הונורה" (manually placed)
- Row 89: "סנט הונורה" (system trying to write)

## Root Cause

After removing "קינמון" (row 88), "סנט הונורה" should have moved from row 89 to row 88, but the code was not updated to reflect this change.

**Product mapping in code:**
```javascript
// Row 87: פטיסייר קינמון
// Row 88: (empty - removed קינמון)
// Row 89: סנט הונורה ← WRONG! Should be row 88
```

**Product mapping in sheets (manual adjustment):**
```javascript
// Row 87: פטיסייר קינמון
// Row 88: סנט הונורה ← Correct!
// Row 89: (empty)
```

**Result:** System kept writing to row 89, creating duplicates.

---

## Solution

Updated the row mapping in both [Code.gs](Code.gs) and [AddHanukkahProducts.gs](AddHanukkahProducts.gs) to move "סנט הונורה" from row 89 to row 88.

### Code Changes

#### [Code.gs:1340-1349](Code.gs#L1340-L1349)

```javascript
// OLD:
'hanukkah_saint_honore': { row: 89, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 },

// NEW:
'hanukkah_saint_honore': { row: 88, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 },
```

#### [AddHanukkahProducts.gs:32](AddHanukkahProducts.gs#L32)

```javascript
// OLD:
{ row: 89, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 }

// NEW:
{ row: 88, name: 'סנט הונורה', category: 'סופגניות חנוכה 2025', price: 19 }
```

---

## Complete Row Structure

### Before Fix:
```
Row 80: קשיו גולד
Row 81: שוקולד קראנץ'
Row 82: גבינה פירורים
Row 83: סוכריות
Row 84: וניל פטל
Row 85: פיסטוק
Row 86: מנגו פסיפלורה
Row 87: פטיסייר קינמון
Row 88: (empty - removed קינמון)
Row 89: סנט הונורה ← Code writes here
Row 90: (blank separator)
Row 91+: אחרים products
```

### After Fix:
```
Row 80: קשיו גולד
Row 81: שוקולד קראנץ'
Row 82: גבינה פירורים
Row 83: סוכריות
Row 84: וניל פטל
Row 85: פיסטוק
Row 86: מנגו פסיפלורה
Row 87: פטיסייר קינמון
Row 88: סנט הונורה ← Code now writes here ✓
Row 89: (available for future products)
Row 90: (blank separator)
Row 91+: אחרים products
```

---

## Manual Sheet Cleanup Required

Since the code was previously writing to row 89, you may have duplicate "סנט הונורה" entries in your sheets. You'll need to manually clean this up:

### Cleanup Steps:

1. **For Each Sheet 11-32 (indices 10-31):**
   - Check row 88: Should have "סנט הונורה"
   - Check row 89: If it has "סנט הונורה", **delete it**
   - If row 88 is empty and row 89 has "סנט הונורה", **move it to row 88**

2. **Summary Sheet (סיכום חודש):**
   - Row 88 should have "סנט הונורה" with its total quantity
   - Row 89 should be empty (or have the first אחרים product)
   - If row 89 has a duplicate "סנט הונורה", delete it and update row 88

### Quick Find & Replace:

You can use Google Sheets' built-in tools:
1. Open spreadsheet
2. Press `Ctrl+H` (Find & Replace)
3. Find: Check for "סנט הונורה" in row 89 across all sheets
4. Manually verify and move/delete as needed

---

## Files Modified

| File | Line | Change |
|------|------|--------|
| [Code.gs](Code.gs#L1340) | 1340 | Updated comment: Rows 80-88 (was 80-89) |
| [Code.gs](Code.gs#L1349) | 1349 | Changed row 89 → 88 for סנט הונורה |
| [AddHanukkahProducts.gs](AddHanukkahProducts.gs#L22) | 22 | Updated comment: Rows 80-88 |
| [AddHanukkahProducts.gs](AddHanukkahProducts.gs#L32) | 32 | Changed row 89 → 88 for סנט הונורה |

---

## Testing Checklist

### After Deployment:

- [ ] **Submit test delivery with סנט הונורה** to sheet "11" or "15"
- [ ] **Check row 88:** Should show סנט הונורה with quantity
- [ ] **Check row 89:** Should be empty (no duplicate)
- [ ] **Submit multiple deliveries** and verify no duplicates appear
- [ ] **Verify confirmation:** סנט הונורה should turn green properly
- [ ] **Check summary sheet:** סנט הונורה totals should be in row 88

### Edge Cases:

- [ ] Test with quantity = 0 (should still write to row 88)
- [ ] Test with multiple submissions to same sheet
- [ ] Verify no data loss or corruption

---

## Deployment Requirements

**✅ YES - Apps Script Redeployment Required**

This is a backend logic change, so you must:

1. **Update Code.gs in Google Apps Script**
2. **Create new deployment** with description: "Fixed סנט הונורה row mapping to 88"
3. **Update frontend URLs** in index.html and confirm.html
4. **Deploy to Vercel**
5. **Manually clean up existing duplicates** in Google Sheets

---

## Impact

### What Changed:
- "סנט הונורה" now writes to row 88 instead of row 89
- Hanukkah products now occupy continuous rows 80-88 (no gaps)
- Row 89 is now available for future products

### What Didn't Change:
- All other Hanukkah products (rows 80-87) unchanged
- Product keys remain the same (`hanukkah_saint_honore`)
- Frontend code (index.html, confirm.html) doesn't need changes
- All logic and functionality unchanged

### Benefits:
- ✓ No more duplicate "סנט הונורה" entries
- ✓ Continuous row structure (easier to read)
- ✓ Matches manual Google Sheets adjustment
- ✓ Row 89 available for future expansion

---

## Backward Compatibility

⚠️ **Existing Data May Have Duplicates**

- Old submissions may have "סנט הונורה" in row 89
- New submissions will write to row 88
- Manual cleanup required to remove duplicates

✅ **New Submissions After Deployment**

- All new data will go to correct row 88
- No more duplicates will be created

---

## Related Changes

This fix is part of the larger "פטיסייר → פטיסייר קינמון" update documented in [PRODUCT_UPDATE_PATISSIER.md](PRODUCT_UPDATE_PATISSIER.md).

**Complete change set:**
1. ✅ Renamed "פטיסייר" → "פטיסייר קינמון" (row 87)
2. ✅ Removed separate "קינמון" product (was row 88)
3. ✅ Moved "סנט הונורה" from row 89 → row 88 (this fix)

---

**Status:** ✅ Fixed
**Date:** December 10, 2024
**Severity:** High (data duplication)
**Deployment Required:** Yes
**Manual Cleanup Required:** Yes
