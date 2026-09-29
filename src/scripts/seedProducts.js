import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { ProductModel } from '../models/Product.js';
import { CategoryModel } from '../models/Category.js';
import { BrandModel } from '../models/Brand.js';
import { products, categories, brands } from '../data/seedData.js';
import { slugify } from '../utils/slugify.js';

async function seedDatabase() {
  console.log('🚀 Starting MongoDB Atlas Products & Categories Seed Script...\n');

  try {
    const connected = await connectDB();
    if (!connected) {
      console.error('❌ Failed to connect to MongoDB. Check MONGODB_URI in .env file.');
      process.exit(1);
    }

    // 1. Seed Categories
    console.log(`📦 Seeding ${categories.length} Categories to MongoDB Atlas...`);
    for (const cat of categories) {
      await CategoryModel.findOneAndUpdate(
        { slug: cat.slug },
        { 
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon || 'Box',
          isActive: true
        },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Categories successfully seeded/updated.\n');

    // 2. Seed Brands
    console.log(`🏷️ Seeding ${brands.length} Brands to MongoDB Atlas...`);
    for (const brandName of brands) {
      const brandSlug = slugify(brandName);
      await BrandModel.findOneAndUpdate(
        { slug: brandSlug },
        {
          name: brandName,
          slug: brandSlug,
          isActive: true
        },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Brands successfully seeded/updated.\n');

    // 3. Seed Products (Upsert by slug / id)
    console.log(`🌱 Seeding ${products.length} Products to MongoDB Atlas...`);
    let insertedCount = 0;
    let updatedCount = 0;

    for (const prod of products) {
      const existing = await ProductModel.findOne({
        $or: [{ id: prod.id }, { slug: prod.slug }]
      });

      if (existing) {
        await ProductModel.updateOne(
          { _id: existing._id },
          { $set: prod }
        );
        updatedCount++;
      } else {
        await ProductModel.create(prod);
        insertedCount++;
      }
    }

    console.log(`\n🎉 Seed Operation Complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total Products Processed: ${products.length}`);
    console.log(`   - Newly Inserted: ${insertedCount}`);
    console.log(`   - Updated Existing: ${updatedCount}`);
    console.log(`   - Total Products in MongoDB Atlas: ${await ProductModel.countDocuments()}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Database Seeding Error:', err);
    process.exit(1);
  }
}

seedDatabase();
