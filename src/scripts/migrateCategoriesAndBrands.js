import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { CategoryModel } from '../models/Category.js';
import { BrandModel } from '../models/Brand.js';
import { ProductModel } from '../models/Product.js';
import { slugify } from '../utils/slugify.js';

export async function runCategoryBrandMigration() {
  console.log('🚀 Running Category & Brand Migration Script...');
  try {
    // 1. Seed standard multi-level Category hierarchy
    const defaultCategories = [
      // Level 1 Root Categories
      { name: 'Components', slug: 'components', level: 1, icon: 'Cpu', order: 1 },
      { name: 'Laptops', slug: 'laptop', level: 1, icon: 'Laptop', order: 2 },
      { name: 'Desktops & Workstations', slug: 'desktop-pc', level: 1, icon: 'Monitor', order: 3 },
      { name: 'Monitors', slug: 'monitor', level: 1, icon: 'Tv', order: 4 },
      { name: 'Accessories & Peripherals', slug: 'accessories', level: 1, icon: 'Headphones', order: 5 },

      // Level 2 under Components
      { name: 'Processors', slug: 'processor', parentSlug: 'components', level: 2, icon: 'Cpu', order: 1 },
      { name: 'Graphics Cards', slug: 'gpu', parentSlug: 'components', level: 2, icon: 'Tv', order: 2 },
      { name: 'Motherboards', slug: 'motherboard', parentSlug: 'components', level: 2, icon: 'Grid', order: 3 },
      { name: 'RAM (Memory)', slug: 'ram', parentSlug: 'components', level: 2, icon: 'HardDrive', order: 4 },
      { name: 'Power Supply', slug: 'power-supply', parentSlug: 'components', level: 2, icon: 'Zap', order: 5 },
      { name: 'SSD & Storage', slug: 'storage', parentSlug: 'components', level: 2, icon: 'Database', order: 6 },
      { name: 'CPU Coolers', slug: 'cpu-cooler', parentSlug: 'components', level: 2, icon: 'Wind', order: 7 },
      { name: 'Casing', slug: 'casing', parentSlug: 'components', level: 2, icon: 'Box', order: 8 },

      // Level 3 under Processors
      { name: 'AMD Processors', slug: 'amd-processor', parentSlug: 'processor', level: 3, order: 1 },
      { name: 'Intel Processors', slug: 'intel-processor', parentSlug: 'processor', level: 3, order: 2 },

      // Level 4 under AMD Processors
      { name: 'Ryzen 7000 Series', slug: 'ryzen-7000-series', parentSlug: 'amd-processor', level: 4, order: 1 },
      { name: 'Ryzen 9000 Series', slug: 'ryzen-9000-series', parentSlug: 'amd-processor', level: 4, order: 2 },

      // Level 3 under Graphics Cards
      { name: 'NVIDIA GeForce', slug: 'nvidia-geforce', parentSlug: 'gpu', level: 3, order: 1 },
      { name: 'AMD Radeon', slug: 'amd-radeon', parentSlug: 'gpu', level: 3, order: 2 },

      // Level 4 under NVIDIA GeForce
      { name: 'RTX 40 Series', slug: 'rtx-40-series', parentSlug: 'nvidia-geforce', level: 4, order: 1 }
    ];

    const categoryDocsMap = {};

    for (const cat of defaultCategories) {
      let parentId = null;
      if (cat.parentSlug && categoryDocsMap[cat.parentSlug]) {
        parentId = categoryDocsMap[cat.parentSlug]._id;
      }

      let catDoc = await CategoryModel.findOne({ slug: cat.slug });
      if (!catDoc) {
        catDoc = await CategoryModel.create({
          name: cat.name,
          slug: cat.slug,
          parent: parentId,
          level: cat.level,
          icon: cat.icon || '',
          order: cat.order || 0,
          isFeatured: true,
          isActive: true
        });
        console.log(`  ➕ Category created: ${cat.name} (${cat.slug})`);
      } else {
        if (parentId && (!catDoc.parent || catDoc.parent.toString() !== parentId.toString())) {
          catDoc.parent = parentId;
          await catDoc.save();
        }
      }
      categoryDocsMap[cat.slug] = catDoc;
    }

    // 2. Seed standard Brands
    const seedBrands = [
      { name: 'ASUS', logo: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300', isFeatured: true },
      { name: 'MSI', logo: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300', isFeatured: true },
      { name: 'Gigabyte', logo: 'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=300', isFeatured: true },
      { name: 'AMD', logo: 'https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=300', isFeatured: true },
      { name: 'Intel', logo: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=300', isFeatured: true },
      { name: 'Corsair', isFeatured: true },
      { name: 'Lenovo', isFeatured: true },
      { name: 'Apple', isFeatured: true },
      { name: 'HP', isFeatured: true },
      { name: 'G.Skill', isFeatured: true },
      { name: 'Deepcool', isFeatured: true },
      { name: 'Samsung', isFeatured: true },
      { name: 'PowerColor', isFeatured: false },
      { name: 'Sapphire', isFeatured: false },
      { name: 'Zotac', isFeatured: false }
    ];

    const brandDocsMap = {};

    for (const b of seedBrands) {
      const bSlug = slugify(b.name);
      let brandDoc = await BrandModel.findOne({ slug: bSlug });
      if (!brandDoc) {
        brandDoc = await BrandModel.create({
          name: b.name,
          slug: bSlug,
          logo: b.logo || '',
          isFeatured: Boolean(b.isFeatured),
          description: `${b.name} official warranty products in Bangladesh.`
        });
        console.log(`  ➕ Brand created: ${b.name}`);
      }
      brandDocsMap[bSlug] = brandDoc;
      brandDocsMap[b.name.toLowerCase()] = brandDoc;
    }

    // 3. Map existing Product string fields (categorySlug, category, brand) to categoryId & brandId refs
    const products = await ProductModel.find();
    let updatedCount = 0;

    for (const p of products) {
      let dirty = false;

      if (!p.categoryId && (p.categorySlug || p.category)) {
        const targetCatSlug = (p.categorySlug || slugify(p.category)).toLowerCase();
        const matchedCat = categoryDocsMap[targetCatSlug] || await CategoryModel.findOne({ slug: targetCatSlug });
        if (matchedCat) {
          p.categoryId = matchedCat._id;
          dirty = true;
        }
      }

      if (!p.brandId && p.brand) {
        const targetBrandSlug = slugify(p.brand);
        const matchedBrand = brandDocsMap[targetBrandSlug] || brandDocsMap[p.brand.toLowerCase()] || await BrandModel.findOne({ slug: targetBrandSlug });
        if (matchedBrand) {
          p.brandId = matchedBrand._id;
          dirty = true;
        }
      }

      if (!p.slug) {
        p.slug = slugify(p.name);
        dirty = true;
      }

      if (dirty) {
        await p.save();
        updatedCount++;
      }
    }

    console.log(`✅ Category & Brand migration complete! Updated ${updatedCount} products with ObjectId refs.`);
  } catch (err) {
    console.error('❌ Migration Error:', err.message);
  }
}

// Allow direct CLI invocation: node src/scripts/migrateCategoriesAndBrands.js
if (process.argv[1] && process.argv[1].endsWith('migrateCategoriesAndBrands.js')) {
  connectDB().then(async (connected) => {
    if (connected) {
      await runCategoryBrandMigration();
      process.exit(0);
    } else {
      console.error('❌ Database connection failed. Cannot run migration.');
      process.exit(1);
    }
  });
}
