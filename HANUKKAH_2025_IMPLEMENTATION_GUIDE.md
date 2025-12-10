# Hanukkah 2025 Implementation Guide
## Zuza Patisserie - Delivery Management System

---

## ✅ What Has Been Done

### 1. **Frontend (index.html)**
The [index.html](index.html) file has been updated with:
- ✅ New category "סופגניות חנוכה 2025" placed at the **beginning** of all categories
- ✅ 10 Hanukkah products in the exact order specified
- ✅ Special styling (blue/gold theme) for the Hanukkah category
- ✅ Product keys properly mapped

**Hanukkah Products (in order):**
1. קשיו גולד (hanukkah_cashew_gold)
2. שוקולד קראנץ' (hanukkah_chocolate_crunch)
3. גבינה פירורים (hanukkah_cheese_crumbs)
4. סוכריות (hanukkah_candies)
5. וניל פטל (hanukkah_vanilla_raspberry)
6. פיסטוק (hanukkah_pistachio)
7. מנגו פסיפלורה (hanukkah_mango_passionfruit)
8. **פטיסייר** (hanukkah_patissier) ⚠️ **SPLIT INTO 2 PRODUCTS**
9. **קינמון** (hanukkah_cinnamon) ⚠️ **SPLIT INTO 2 PRODUCTS**
10. סנט הונורה (hanukkah_saint_honore)

### 2. **Backend (Code.gs)**
A complete Google Apps Script file has been created with:
- ✅ Hanukkah products mapped to rows **95-104** (10 products)
- ✅ Row 95: קשיו גולד - 19 ש"ח
- ✅ Row 96: שוקולד קראנץ' - 19 ש"ח
- ✅ Row 97: גבינה פירורים - 17 ש"ח
- ✅ Row 98: סוכריות - 15 ש"ח
- ✅ Row 99: וניל פטל - 19 ש"ח
- ✅ Row 100: פיסטוק - 19 ש"ח
- ✅ Row 101: מנגו פסיפלורה - 17 ש"ח
- ✅ Row 102: **פטיסייר** - 15 ש"ח
- ✅ Row 103: **קינמון** - 15 ש"ח
- ✅ Row 104: סנט הונורה - 19 ש"ח
- ✅ Custom products start at row 105
- ✅ Only affects sheets from index 10 onwards

---

## 📋 Implementation Steps

### Step 1: Deploy Frontend
The [index.html](index.html) file is already updated and ready to use. Just deploy it to Vercel or your hosting service.

### Step 2: Update Google Apps Script
1. Open your Google Spreadsheet
2. Go to **Extensions > Apps Script**
3. **Replace the entire Code.gs content** with the content from the new [Code.gs](Code.gs) file
4. Save and deploy as a new version

### Step 3: Manually Add Products to Google Sheets

⚠️ **IMPORTANT: The script does NOT automatically create rows in the spreadsheet!**

You need to **manually add the Hanukkah products** to your Google Sheets:

#### For Each Sheet (Starting from Sheet 10):
1. Go to **row 95** and add:
   - Column A (Product Name): קשיו גולד
   - Column B (Category): סופגניות חנוכה 2025
   - Column C (Quantity): (leave empty, will be filled by submissions)
   - Column D (Notes): (leave empty)
   - Column E (Last Updated): (leave empty)

2. Continue for rows 96-104 with the products listed above

#### Quick Copy-Paste Template:
```
Row 95:  קשיו גולד          | סופגניות חנוכה 2025
Row 96:  שוקולד קראנץ'      | סופגניות חנוכה 2025
Row 97:  גבינה פירורים      | סופגניות חנוכה 2025
Row 98:  סוכריות            | סופגניות חנוכה 2025
Row 99:  וניל פטל           | סופגניות חנוכה 2025
Row 100: פיסטוק             | סופגניות חנוכה 2025
Row 101: מנגו פסיפלורה      | סופגניות חנוכה 2025
Row 102: פטיסייר            | סופגניות חנוכה 2025
Row 103: קינמון              | סופגניות חנוכה 2025
Row 104: סנט הונורה          | סופגניות חנוכה 2025
```

### Step 4: Update Summary Sheet (סיכום חודש)

Add these 10 products to your "סיכום חודש" sheet with their prices:

| Product Name | Price (₪) |
|--------------|-----------|
| קשיו גולד | 19 |
| שוקולד קראנץ' | 19 |
| גבינה פירורים | 17 |
| סוכריות | 15 |
| וניל פטל | 19 |
| פיסטוק | 19 |
| מנגו פסיפלורה | 17 |
| פטיסייר | 15 |
| קינמון | 15 |
| סנט הונורה | 19 |

**Total: 10 products**

---

## ⚠️ Critical Notes

1. **Rows 95-104** are now reserved for Hanukkah products
2. **Custom products** now start at **row 105** (was 105, stays the same)
3. **Sheets 1-9** are NOT affected
4. **Sheets 10+** will have the Hanukkah products available
5. פטיסייר and קינמון are now **2 separate products**, not 1 merged product

---

## 🧪 Testing Checklist

- [ ] Deploy updated [index.html](index.html)
- [ ] Update Google Apps Script with [Code.gs](Code.gs)
- [ ] Manually add rows 95-104 to sheet 10+
- [ ] Test submission from frontend
- [ ] Verify Hanukkah category appears first
- [ ] Verify all 10 products are listed in correct order
- [ ] Verify products save to correct rows (95-104)
- [ ] Verify custom products still save from row 105+
- [ ] Test email confirmations
- [ ] Update summary sheet with prices

---

## 📞 Support

If you encounter any issues:
1. Check that rows 95-104 exist in your sheets
2. Verify the Apps Script is deployed correctly
3. Check the browser console for any JavaScript errors
4. Review the Apps Script execution logs

---

**Version:** Hanukkah 2025 Release
**Date:** December 2024
**Status:** Ready for deployment
