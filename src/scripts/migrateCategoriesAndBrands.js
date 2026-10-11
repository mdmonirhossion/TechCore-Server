import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { CategoryModel } from '../models/Category.js';
import { BrandModel } from '../models/Brand.js';
import { slugify } from '../utils/slugify.js';

export async function runCategoryBrandMigration() {
  console.log('🚀 Running Category & Brand Migration Script...');
  try {
    // 1. Seed standard multi-level Category hierarchy (idempotent upsert by slug)
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
      { name: 'Intel Processors', slug: 'intel-processor', parentSlug: 'processor', level: 3, order: 1 },
      { name: 'AMD Processors', slug: 'amd-processor', parentSlug: 'processor', level: 3, order: 2 },
      { name: 'Server CPU', slug: 'server-cpu', parentSlug: 'processor', level: 3, order: 3 },

      // Level 4 under AMD Processors
      { name: 'Ryzen 7000 Series', slug: 'ryzen-7000-series', parentSlug: 'amd-processor', level: 4, order: 1 },
      { name: 'Ryzen 9000 Series', slug: 'ryzen-9000-series', parentSlug: 'amd-processor', level: 4, order: 2 },

      // Level 3 under Graphics Cards
      { name: 'NVIDIA GeForce', slug: 'nvidia-geforce', parentSlug: 'gpu', level: 3, order: 1 },
      { name: 'AMD Radeon', slug: 'amd-radeon', parentSlug: 'gpu', level: 3, order: 2 },
      { name: 'PowerColor Series', slug: 'powercolor-gpu', parentSlug: 'gpu', level: 3, order: 3 },
      { name: 'Manli Series', slug: 'manli-gpu', parentSlug: 'gpu', level: 3, order: 4 },

      // Level 4 under NVIDIA GeForce & AMD Radeon
      { name: 'RTX 40 Series', slug: 'rtx-40-series', parentSlug: 'nvidia-geforce', level: 4, order: 1 },
      { name: 'RTX 30 Series', slug: 'rtx-30-series', parentSlug: 'nvidia-geforce', level: 4, order: 2 },
      { name: 'RX 7000 Series', slug: 'rx-7000-series', parentSlug: 'amd-radeon', level: 4, order: 1 },

      // Level 3 under Motherboards
      { name: 'Intel Motherboards (LGA1700)', slug: 'intel-motherboard', parentSlug: 'motherboard', level: 3, order: 1 },
      { name: 'AMD Motherboards (AM5/AM4)', slug: 'amd-motherboard', parentSlug: 'motherboard', level: 3, order: 2 },

      // Level 3 under RAM
      { name: 'Desktop DDR5 RAM', slug: 'ddr5-ram', parentSlug: 'ram', level: 3, order: 1 },
      { name: 'Desktop DDR4 RAM', slug: 'ddr4-ram', parentSlug: 'ram', level: 3, order: 2 },
      { name: 'Laptop RAM', slug: 'laptop-ram', parentSlug: 'ram', level: 3, order: 3 },

      // Level 3 under SSD & Storage
      { name: 'M.2 NVMe PCIe SSD', slug: 'nvme-ssd', parentSlug: 'storage', level: 3, order: 1 },
      { name: 'SATA 2.5 Inch SSD', slug: 'sata-ssd', parentSlug: 'storage', level: 3, order: 2 },
      { name: 'Desktop Hard Drive', slug: 'hdd-storage', parentSlug: 'storage', level: 3, order: 3 },

      // Level 3 under Power Supply
      { name: '80 PLUS Gold PSU', slug: 'gold-psu', parentSlug: 'power-supply', level: 3, order: 1 },
      { name: '80 PLUS Bronze PSU', slug: 'bronze-psu', parentSlug: 'power-supply', level: 3, order: 2 },

      // Level 3 under CPU Coolers
      { name: 'Air Cooler', slug: 'air-cooler', parentSlug: 'cpu-cooler', level: 3, order: 1 },
      { name: 'Liquid AIO Cooler', slug: 'liquid-cooler', parentSlug: 'cpu-cooler', level: 3, order: 2 },

      // Level 3 under Casing
      { name: 'Gaming Casing', slug: 'gaming-casing', parentSlug: 'casing', level: 3, order: 1 },
      { name: 'Mid Tower Casing', slug: 'mid-tower-casing', parentSlug: 'casing', level: 3, order: 2 },

      // Level 2 under Laptops
      { name: 'Gaming Laptop', slug: 'gaming-laptop', parentSlug: 'laptop', level: 2, icon: 'Gamepad2', order: 1 },
      { name: 'Ultrabook & Premium', slug: 'ultrabook', parentSlug: 'laptop', level: 2, icon: 'Laptop', order: 2 },

      // Level 3 under Gaming Laptop
      { name: 'ASUS ROG / TUF Gaming', slug: 'asus-gaming-laptop', parentSlug: 'gaming-laptop', level: 3, order: 1 },
      { name: 'Lenovo Legion / LOQ', slug: 'lenovo-gaming-laptop', parentSlug: 'gaming-laptop', level: 3, order: 2 },
      { name: 'MSI Gaming Series', slug: 'msi-gaming-laptop', parentSlug: 'gaming-laptop', level: 3, order: 3 },
      { name: 'HP Victus / OMEN', slug: 'hp-gaming-laptop', parentSlug: 'gaming-laptop', level: 3, order: 4 },

      // Level 3 under Ultrabook
      { name: 'Apple MacBook Pro & Air', slug: 'apple-macbook', parentSlug: 'ultrabook', level: 3, order: 1 },
      { name: 'Dell XPS & Inspiron', slug: 'dell-ultrabook', parentSlug: 'ultrabook', level: 3, order: 2 },
      { name: 'HP Spectre & Envy', slug: 'hp-ultrabook', parentSlug: 'ultrabook', level: 3, order: 3 },

      // Level 2 under Desktops & Workstations
      { name: 'Gaming Desktop PC', slug: 'gaming-pc', parentSlug: 'desktop-pc', level: 2, icon: 'Cpu', order: 1 },
      { name: 'Brand PC & All-in-One', slug: 'brand-pc', parentSlug: 'desktop-pc', level: 2, icon: 'Monitor', order: 2 },
      { name: 'Custom Workstation PC', slug: 'workstation-pc', parentSlug: 'desktop-pc', level: 2, icon: 'Server', order: 3 },

      // Level 3 under Gaming Desktop PC
      { name: 'Intel Gaming Desktop', slug: 'intel-gaming-pc', parentSlug: 'gaming-pc', level: 3, order: 1 },
      { name: 'AMD Gaming Desktop', slug: 'amd-gaming-pc', parentSlug: 'gaming-pc', level: 3, order: 2 },

      // Level 3 under Brand PC & All-in-One
      { name: 'ASUS Brand PC', slug: 'asus-brand-pc', parentSlug: 'brand-pc', level: 3, order: 1 },
      { name: 'HP Brand PC', slug: 'hp-brand-pc', parentSlug: 'brand-pc', level: 3, order: 2 },
      { name: 'Dell Brand PC', slug: 'dell-brand-pc', parentSlug: 'brand-pc', level: 3, order: 3 },

      // Level 3 under Custom Workstation PC
      { name: 'Content Creation Rig', slug: 'creator-workstation', parentSlug: 'workstation-pc', level: 3, order: 1 },
      { name: 'AI & Deep Learning Station', slug: 'ai-workstation', parentSlug: 'workstation-pc', level: 3, order: 2 },

      // Level 2 under Monitors
      { name: 'Gaming Monitor', slug: 'gaming-monitor', parentSlug: 'monitor', level: 2, icon: 'Monitor', order: 1 },
      { name: '4K & Professional Monitor', slug: '4k-monitor', parentSlug: 'monitor', level: 2, icon: 'Tv', order: 2 },

      // Level 3 under Gaming Monitor
      { name: '100Hz - 165Hz Gaming Monitors', slug: '165hz-gaming-monitor', parentSlug: 'gaming-monitor', level: 3, order: 1 },
      { name: '240Hz+ Esports Monitors', slug: '240hz-gaming-monitor', parentSlug: 'gaming-monitor', level: 3, order: 2 },

      // Level 3 under 4K & Professional Monitor
      { name: '4K UHD Color Accurate IPS', slug: '4k-uhd-monitor', parentSlug: '4k-monitor', level: 3, order: 1 },
      { name: 'Curved Ultrawide Monitors', slug: 'ultrawide-monitor', parentSlug: '4k-monitor', level: 3, order: 2 }
    ];

    const categoryDocsMap = {};

    for (const cat of defaultCategories) {
      let parentId = null;
      if (cat.parentSlug) {
        if (categoryDocsMap[cat.parentSlug]) {
          parentId = categoryDocsMap[cat.parentSlug]._id;
        } else {
          const parentDoc = await CategoryModel.findOne({ slug: cat.parentSlug });
          if (parentDoc) {
            parentId = parentDoc._id;
            categoryDocsMap[cat.parentSlug] = parentDoc;
          }
        }
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
        let changed = false;
        if (parentId && (!catDoc.parent || catDoc.parent.toString() !== parentId.toString())) {
          catDoc.parent = parentId;
          changed = true;
        }
        if (catDoc.level !== cat.level) {
          catDoc.level = cat.level;
          changed = true;
        }
        if (cat.icon && !catDoc.icon) {
          catDoc.icon = cat.icon;
          changed = true;
        }
        if (cat.order && catDoc.order === 0) {
          catDoc.order = cat.order;
          changed = true;
        }
        if (catDoc.isActive === false) {
          catDoc.isActive = true;
          changed = true;
        }
        if (changed) {
          await catDoc.save();
        }
      }
      categoryDocsMap[cat.slug] = catDoc;
    }

    // 2. Seed standard Brands (idempotent upsert by slug)
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
    }

    console.log(`✅ Category & Brand migration complete! All categories idempotently ensured.`);
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
