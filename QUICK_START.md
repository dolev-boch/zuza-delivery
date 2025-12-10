# Quick Start - Hanukkah 2025 Products

## 🚀 Fast Implementation (3 Steps)

### Step 1: Update Apps Script (2 minutes)
1. Open your spreadsheet: `1U6u_j9lsTwDQ52mnJWJM1eIZ2CqbmqiwBqEQnD21Ia4`
2. Go to **Extensions → Apps Script**
3. Replace `Code.gs` with the content from [Code.gs](Code.gs)
4. Click **Deploy → New deployment**
5. Copy the new Web App URL

### Step 2: Auto-Add Products to Sheets (1 minute)
1. In Apps Script, create a new file: **AddHanukkahProducts.gs**
2. Paste content from [AddHanukkahProducts.gs](AddHanukkahProducts.gs)
3. Run function: `addHanukkahProductsToAllSheets`
4. Grant permissions when prompted
5. Check the log - should say "✓ DONE!"

### Step 3: Deploy Frontend (1 minute)
1. The [index.html](index.html) is already updated
2. Just redeploy to Vercel (if that's where it's hosted)
3. Done!

---

## ✅ Verification Checklist

After implementation, verify:

- [ ] Open the web form - see "🕎 סופגניות חנוכה 2025" at the **top**
- [ ] The category shows **10 products**
- [ ] Products are in this order:
  1. קשיו גולד
  2. שוקולד קראנץ'
  3. גבינה פירורים
  4. סוכריות
  5. וניל פטל
  6. פיסטוק
  7. מנגו פסיפלורה
  8. פטיסייר
  9. קינמון
  10. סנט הונורה
- [ ] Submit a test delivery with 2-3 Hanukkah products
- [ ] Check sheet 10 or later - rows 95-104 should have data
- [ ] Email received with Hanukkah products listed

---

## 🎯 What Changed

### Frontend ([index.html](index.html))
- ✅ New category at the beginning: **סופגניות חנוכה 2025**
- ✅ Special blue/gold styling for Hanukkah
- ✅ 10 products in exact order
- ✅ **פטיסייר** and **קינמון** are now 2 separate products

### Backend ([Code.gs](Code.gs))
- ✅ Products mapped to **rows 95-104**
- ✅ Prices included in PRODUCT_ROW_MAP
- ✅ Only affects sheets from index **10 onwards**
- ✅ Custom products start at row **105**

### Prices (for Summary Sheet)
```
קשיו גולד         19 ש"ח
שוקולד קראנץ'      19 ש"ח
גבינה פירורים     17 ש"ח
סוכריות           15 ש"ח
וניל פטל          19 ש"ח
פיסטוק            19 ש"ח
מנגו פסיפלורה     17 ש"ח
פטיסייר           15 ש"ח
קינמון             15 ש"ח
סנט הונורה        19 ש"ח
```

---

## 🆘 Troubleshooting

**Problem:** Hanukkah category doesn't appear at the top
- **Solution:** Clear browser cache and reload

**Problem:** Products not saving to correct rows
- **Solution:** Run `addHanukkahProductsToAllSheets` again

**Problem:** Script says "Row already contains data"
- **Solution:** Normal - it's skipping rows that already have products

**Problem:** Email doesn't show Hanukkah products
- **Solution:** Make sure you deployed the new Apps Script version

---

## 📞 Need Help?

Check the full guide: [HANUKKAH_2025_IMPLEMENTATION_GUIDE.md](HANUKKAH_2025_IMPLEMENTATION_GUIDE.md)

---

**Ready to go!** 🕎✨
