import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { CategoryModel } from '../models/Category.js';
import { ProductModel } from '../models/Product.js';
import { slugify } from '../utils/slugify.js';

export async function runBackfillProductCategoryIds() {
  const isApply = process.argv.includes('--apply');

  console.log('====================================================');
  console.log(`📦 Product CategoryId Backfill Script (${isApply ? '🚀 APPLY MODE' : '🔍 DRY-RUN MODE'})`);
  console.log('====================================================\n');

  const connected = await connectDB();
  if (!connected) {
    console.error('❌ Failed to connect to MongoDB. Cannot perform backfill.');
    process.exit(1);
  }

  try {
    const categories = await CategoryModel.find().lean();
    console.log(`📂 Loaded ${categories.length} categories from database.`);

    const slugMap = new Map();
    const nameMap = new Map();

    for (const cat of categories) {
      if (cat.slug) slugMap.set(cat.slug.toLowerCase().trim(), cat);
      if (cat.name) nameMap.set(cat.name.toLowerCase().trim(), cat);
    }

    // Common category synonyms/aliases
    const aliases = {
      'desktop': 'desktop-pc',
      'desktop pc': 'desktop-pc',
      'desktops': 'desktop-pc',
      'cpu': 'processor',
      'processors': 'processor',
      'gpu': 'gpu',
      'graphics card': 'gpu',
      'graphics cards': 'gpu',
      'ram': 'ram',
      'memory': 'ram',
      'ssd': 'storage',
      'storage': 'storage',
      'power supply': 'power-supply',
      'psu': 'power-supply',
      'casing': 'casing',
      'case': 'casing',
      'cpu cooler': 'cpu-cooler',
      'cooler': 'cpu-cooler',
      'laptops': 'laptop',
      'gaming laptop': 'gaming-laptop',
      'monitors': 'monitor',
      'gaming monitor': 'gaming-monitor'
    };

    function findMatchingCategory(p) {
      const candidates = [
        p.categorySlug,
        p.category,
        p.builderCategory,
        p.category ? slugify(p.category) : null,
        p.builderCategory ? slugify(p.builderCategory) : null
      ].filter(Boolean);

      for (const cand of candidates) {
        const norm = String(cand).toLowerCase().trim();

        // 1. Exact slug match
        if (slugMap.has(norm)) return slugMap.get(norm);

        // 2. Exact name match
        if (nameMap.has(norm)) return nameMap.get(norm);

        // 3. Alias match
        const aliasTarget = aliases[norm];
        if (aliasTarget && slugMap.has(aliasTarget)) {
          return slugMap.get(aliasTarget);
        }
      }

      // Fallback substring search
      for (const cand of candidates) {
        const norm = String(cand).toLowerCase().trim();
        for (const [slug, cat] of slugMap.entries()) {
          if (slug.includes(norm) || norm.includes(slug)) {
            return cat;
          }
        }
      }

      return null;
    }

    const products = await ProductModel.find();
    console.log(`📦 Loaded ${products.length} products to check.\n`);

    const toUpdate = [];
    const unmatched = [];
    let alreadyLinked = 0;

    for (const p of products) {
      // If categoryId is already set and valid
      if (p.categoryId) {
        const existingCat = categories.find(c => c._id.toString() === p.categoryId.toString());
        if (existingCat) {
          alreadyLinked++;
          continue;
        }
      }

      const matchedCat = findMatchingCategory(p);

      if (matchedCat) {
        toUpdate.push({ product: p, category: matchedCat });
        console.log(
          `  [MATCH] "${p.name}" (SKU: ${p.sku || p.id})\n` +
          `    -> would set categoryId: ${matchedCat._id} (${matchedCat.name} / ${matchedCat.slug})`
        );
      } else {
        unmatched.push(p);
        console.log(
          `  ⚠️ [UNMATCHED] "${p.name}" (SKU: ${p.sku || p.id})\n` +
          `    [category: "${p.category}", categorySlug: "${p.categorySlug}", builderCategory: "${p.builderCategory}"]`
        );
      }
    }

    console.log('\n---------------- SUMMARY ----------------');
    console.log(`Total Products Checked:  ${products.length}`);
    console.log(`Already Linked Correct:  ${alreadyLinked}`);
    console.log(`Matched to Backfill:     ${toUpdate.length}`);
    console.log(`Unmatched Products:      ${unmatched.length}`);
    console.log('-----------------------------------------\n');

    if (isApply) {
      console.log(`🚀 Writing updates for ${toUpdate.length} products to MongoDB...`);
      let successCount = 0;
      for (const item of toUpdate) {
        item.product.categoryId = item.category._id;
        if (!item.product.categorySlug || item.product.categorySlug === 'general') {
          item.product.categorySlug = item.category.slug;
        }
        await item.product.save();
        successCount++;
      }
      console.log(`✅ Successfully backfilled ${successCount} products with categoryId in MongoDB!`);
    } else {
      console.log('ℹ️  DRY-RUN MODE: No changes were written to the database.');
      console.log("👉 Run with '--apply' flag to persist updates: node src/scripts/backfillProductCategoryIds.js --apply\n");
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Backfill Error:', err);
    process.exit(1);
  }
}

// Allow direct CLI invocation: node src/scripts/backfillProductCategoryIds.js [--apply]
if (process.argv[1] && process.argv[1].endsWith('backfillProductCategoryIds.js')) {
  runBackfillProductCategoryIds();
}
