import express from 'express';
import mongoose from 'mongoose';
import { CategoryModel } from '../models/Category.js';
import { ProductModel } from '../models/Product.js';
import { getCategoryFilterConfig } from '../config/filterConfig.js';
import { runCategoryBrandMigration } from '../scripts/migrateCategoriesAndBrands.js';

const router = express.Router();

// Helper to verify MongoDB readiness
function isMongoConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// Lazy check to auto-seed if database has fewer categories than expected
let seedChecked = false;
async function ensureCategoryTreeSeeded() {
  if (seedChecked || !isMongoConnected()) return;
  try {
    const count = await CategoryModel.countDocuments();
    if (count < 25) {
      await runCategoryBrandMigration();
    }
    seedChecked = true;
  } catch {
    // Non-blocking; continue to let route query or return 503
  }
}

/**
 * GET /api/categories/tree
 * Returns active categories as a nested tree sorted by `order` (supports up to 4 levels).
 * fullPath = slugs joined with '/' from the root (e.g. "laptop/gaming-laptop").
 * Cache-Control: public, s-maxage=300, stale-while-revalidate=600.
 */
router.get('/tree', async (req, res) => {
  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: 'Database service unavailable. MongoDB is not connected.'
    });
  }

  try {
    await ensureCategoryTreeSeeded();

    const activeCategories = await CategoryModel.find({ isActive: { $ne: false } })
      .sort({ order: 1, name: 1 })
      .lean();

    // Map each doc by its string id
    const nodeMap = new Map();
    const roots = [];

    for (const cat of activeCategories) {
      const idStr = cat._id.toString();
      nodeMap.set(idStr, {
        id: idStr,
        name: cat.name,
        slug: cat.slug,
        fullPath: cat.slug,
        icon: cat.icon || '',
        image: cat.image || '',
        order: typeof cat.order === 'number' ? cat.order : 0,
        parent: cat.parent ? cat.parent.toString() : null,
        children: []
      });
    }

    // Attach children to parents
    for (const node of nodeMap.values()) {
      if (node.parent && nodeMap.has(node.parent)) {
        nodeMap.get(node.parent).children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Recursively build tree with fullPath, order sorting, and 4-level cap
    function processNode(node, parentPath = '', level = 1) {
      const fullPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;

      let processedChildren = [];
      if (level < 4 && Array.isArray(node.children) && node.children.length > 0) {
        node.children.sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || a.name.localeCompare(b.name));
        processedChildren = node.children.map(child => processNode(child, fullPath, level + 1));
      }

      // Keep only requested fields: id, name, slug, fullPath, icon, image, children
      return {
        id: node.id,
        name: node.name,
        slug: node.slug,
        fullPath,
        icon: node.icon || '',
        image: node.image || '',
        children: processedChildren
      };
    }

    roots.sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || a.name.localeCompare(b.name));
    const tree = roots.map(root => processNode(root, '', 1));

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.json(tree);
  } catch (err) {
    if (
      !isMongoConnected() ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoNetworkError' ||
      err.name === 'MongoTimeoutError' ||
      err.name === 'MongooseError' ||
      err.message?.includes('buffering timed out') ||
      err.message?.includes('topology was destroyed') ||
      err.message?.includes('connection')
    ) {
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable. MongoDB is not connected.',
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve category tree',
      error: err.message
    });
  }
});

/**
 * Slug alias mapping to support both singular/plural and legacy client slugs
 */
const SLUG_ALIASES = {
  'component': ['components'],
  'components': ['component'],
  'laptop': ['laptops'],
  'laptops': ['laptop'],
  'desktop': ['desktop-pc', 'desktops'],
  'desktop-pc': ['desktop', 'desktops'],
  'monitor': ['monitors'],
  'monitors': ['monitor'],
  'accessories': ['accessory', 'accessories-peripherals'],
  'gpu': ['graphics-card'],
  'graphics-card': ['gpu'],
  'psu': ['power-supply'],
  'power-supply': ['psu'],
  'ram': ['memory'],
  'storage': ['ssd-storage'],
  'intel': ['intel-processor', 'intel-motherboard'],
  'amd': ['amd-processor', 'amd-motherboard'],
  'rtx-40': ['rtx-40-series', 'nvidia-geforce'],
  'rtx-30': ['rtx-30-series'],
  'rx-7000': ['rx-7000-series', 'amd-radeon'],
  'ddr5': ['ddr5-ram'],
  'ddr4': ['ddr4-ram'],
  'laptop-ram': ['laptop-memory'],
  'nvme-ssd': ['m2-nvme-ssd'],
  'sata-ssd': ['sata-25-ssd'],
  'hdd': ['hdd-storage'],
  'gold': ['gold-psu'],
  'bronze': ['bronze-psu'],
  'asus': ['asus-gaming-laptop', 'asus-brand-pc'],
  'lenovo': ['lenovo-gaming-laptop'],
  'msi': ['msi-gaming-laptop'],
  'hp': ['hp-gaming-laptop', 'hp-ultrabook', 'hp-brand-pc'],
  'apple': ['apple-macbook'],
  'dell': ['dell-ultrabook', 'dell-brand-pc'],
  '165hz': ['165hz-gaming-monitor'],
  '240hz': ['240hz-gaming-monitor'],
  'uhd': ['4k-uhd-monitor'],
  'ultrawide': ['ultrawide-monitor']
};

function matchCategory(categories, segment, parentId = null) {
  const norm = segment.toLowerCase();

  // 1. Exact slug match under parent
  let match = categories.find(c => {
    const parentMatches = parentId === null
      ? (!c.parent || c.parent === null)
      : (c.parent && c.parent.toString() === parentId.toString());
    return parentMatches && c.slug.toLowerCase() === norm;
  });
  if (match) return match;

  // 2. Known alias match under parent
  const aliases = SLUG_ALIASES[norm] || [];
  for (const alias of aliases) {
    match = categories.find(c => {
      const parentMatches = parentId === null
        ? (!c.parent || c.parent === null)
        : (c.parent && c.parent.toString() === parentId.toString());
      return parentMatches && c.slug.toLowerCase() === alias.toLowerCase();
    });
    if (match) return match;
  }

  // 3. Fallback: prefix/suffix/partial match under parent
  match = categories.find(c => {
    const parentMatches = parentId === null
      ? (!c.parent || c.parent === null)
      : (c.parent && c.parent.toString() === parentId.toString());
    if (!parentMatches) return false;
    const cSlug = c.slug.toLowerCase();
    return cSlug.startsWith(norm + '-') || cSlug.endsWith('-' + norm) || cSlug.includes(norm);
  });

  return match || null;
}

/**
 * Shared handler for computing category facets / filters aggregation
 */
async function handleCategoryFilters(req, res, rawPath) {
  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: 'Database service unavailable. MongoDB is not connected.'
    });
  }

  try {
    await ensureCategoryTreeSeeded();

    const segments = rawPath
      .split('/')
      .filter(Boolean)
      .map(s => decodeURIComponent(s).trim().toLowerCase());

    if (segments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category path not specified or not found'
      });
    }

    const allCategories = await CategoryModel.find({ isActive: { $ne: false } }).lean();

    let currentParentId = null;
    let targetCategory = null;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const matched = matchCategory(allCategories, seg, currentParentId);
      if (!matched) {
        return res.status(404).json({
          success: false,
          message: `Category not found for segment: ${seg} in path: ${rawPath}`
        });
      }
      currentParentId = matched._id;
      targetCategory = matched;
    }

    // Collect all descendants (including category itself)
    const descendantIds = [targetCategory._id];
    const descendantSlugs = [targetCategory.slug];
    const queue = [targetCategory._id.toString()];

    while (queue.length > 0) {
      const parentIdStr = queue.shift();
      for (const cat of allCategories) {
        if (cat.parent && cat.parent.toString() === parentIdStr) {
          descendantIds.push(cat._id);
          descendantSlugs.push(cat.slug);
          queue.push(cat._id.toString());
        }
      }
    }

    const categoryMatch = {
      $or: [
        { categoryId: { $in: descendantIds } },
        { categorySlug: { $in: descendantSlugs } }
      ]
    };

    // Get whitelisted specs for this category
    const specConfigs = getCategoryFilterConfig(targetCategory.slug) || getCategoryFilterConfig(rawPath);

    const facetObj = {
      priceStats: [
        {
          $project: {
            effectivePrice: {
              $cond: [
                { $and: [{ $ne: ['$discountPrice', null] }, { $gt: ['$discountPrice', 0] }] },
                '$discountPrice',
                '$price'
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            min: { $min: '$effectivePrice' },
            max: { $max: '$effectivePrice' }
          }
        }
      ],
      brands: [
        { $match: { brand: { $exists: true, $ne: '' } } },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }
      ],
      availability: [
        { $group: { _id: '$stockStatus', count: { $sum: 1 } } }
      ]
    };

    for (const specItem of specConfigs) {
      facetObj[`spec_${specItem.key}`] = [
        { $match: { [`specifications.${specItem.key}`]: { $exists: true, $ne: null, $ne: '' } } },
        { $group: { _id: `$specifications.${specItem.key}`, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }
      ];
    }

    const [aggregationResult] = await ProductModel.aggregate([
      { $match: categoryMatch },
      { $facet: facetObj }
    ]);

    const priceStats = aggregationResult?.priceStats?.[0] || {};
    const priceRange = {
      min: typeof priceStats.min === 'number' ? priceStats.min : 0,
      max: typeof priceStats.max === 'number' ? priceStats.max : 0
    };

    const brands = (aggregationResult?.brands || []).map(b => ({
      name: String(b._id),
      count: b.count
    }));

    const availMap = {
      IN_STOCK: 0,
      PRE_ORDER: 0,
      UP_COMING: 0,
      OUT_OF_STOCK: 0
    };
    for (const item of aggregationResult?.availability || []) {
      if (item._id && availMap.hasOwnProperty(item._id)) {
        availMap[item._id] = item.count;
      }
    }

    const specs = [];
    for (const specItem of specConfigs) {
      const facetValues = aggregationResult?.[`spec_${specItem.key}`] || [];
      const values = facetValues
        .filter(v => v._id !== null && v._id !== undefined && String(v._id).trim() !== '')
        .map(v => ({
          value: String(v._id).trim(),
          count: v.count
        }));

      // Only include spec groups that actually have values
      if (values.length > 0) {
        specs.push({
          key: specItem.key,
          label: specItem.label,
          values
        });
      }
    }

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.json({
      priceRange,
      brands,
      availability: availMap,
      specs
    });
  } catch (err) {
    if (
      !isMongoConnected() ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoNetworkError' ||
      err.name === 'MongoTimeoutError' ||
      err.name === 'MongooseError' ||
      err.message?.includes('buffering timed out') ||
      err.message?.includes('topology was destroyed') ||
      err.message?.includes('connection')
    ) {
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable. MongoDB is not connected.',
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to compute category filters',
      error: err.message
    });
  }
}

/**
 * GET /api/categories/by-path/<path>/filters
 * Returns:
 * { priceRange: { min, max }, brands: [{ name, count }], availability: { IN_STOCK, ... }, specs: [{ key, label, values }] }
 */
router.get('/by-path/*/filters', async (req, res) => {
  const rawPath = req.params[0] || '';
  return handleCategoryFilters(req, res, rawPath);
});

/**
 * GET /api/categories/by-path/*
 * Resolves a full path and returns:
 * { category, breadcrumb:[...], children:[...], descendantSlugs:[...], descendantIds:[...] }
 * (descendants include the category itself). 404 JSON if not found.
 */
router.get(['/by-path', '/by-path/*'], async (req, res) => {
  const rawPath = req.params[0] || req.params['*'] || '';

  // Intercept if path ends with /filters
  if (rawPath.endsWith('/filters')) {
    const cleanPath = rawPath.replace(/\/filters$/, '');
    return handleCategoryFilters(req, res, cleanPath);
  }

  if (!isMongoConnected()) {
    return res.status(503).json({
      success: false,
      message: 'Database service unavailable. MongoDB is not connected.'
    });
  }

  try {
    await ensureCategoryTreeSeeded();

    const segments = rawPath
      .split('/')
      .filter(Boolean)
      .map(s => decodeURIComponent(s).trim().toLowerCase());

    if (segments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category path not specified or not found'
      });
    }

    const allCategories = await CategoryModel.find({ isActive: { $ne: false } }).lean();

    const breadcrumb = [];
    let currentParentId = null;
    let targetCategory = null;
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const matched = matchCategory(allCategories, seg, currentParentId);
      if (!matched) {
        return res.status(404).json({
          success: false,
          message: `Category not found for segment: ${seg} in path: ${rawPath}`
        });
      }

      currentParentId = matched._id;
      targetCategory = matched;
      currentPath = currentPath ? `${currentPath}/${matched.slug}` : matched.slug;

      breadcrumb.push({
        id: matched._id.toString(),
        name: matched.name,
        slug: matched.slug,
        fullPath: currentPath
      });
    }

    // Immediate children sorted by order
    const childDocs = allCategories.filter(
      c => c.parent && c.parent.toString() === targetCategory._id.toString()
    );
    childDocs.sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || a.name.localeCompare(b.name));

    const children = childDocs.map(c => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      fullPath: `${currentPath}/${c.slug}`,
      icon: c.icon || '',
      image: c.image || '',
      order: typeof c.order === 'number' ? c.order : 0
    }));

    // Descendants (including the category itself)
    const descendantIds = [targetCategory._id.toString()];
    const descendantSlugs = [targetCategory.slug];
    const queue = [targetCategory._id.toString()];

    while (queue.length > 0) {
      const parentIdStr = queue.shift();
      for (const cat of allCategories) {
        if (cat.parent && cat.parent.toString() === parentIdStr) {
          const catIdStr = cat._id.toString();
          descendantIds.push(catIdStr);
          descendantSlugs.push(cat.slug);
          queue.push(catIdStr);
        }
      }
    }

    const category = {
      id: targetCategory._id.toString(),
      name: targetCategory.name,
      slug: targetCategory.slug,
      fullPath: currentPath,
      icon: targetCategory.icon || '',
      image: targetCategory.image || '',
      level: targetCategory.level || segments.length,
      order: typeof targetCategory.order === 'number' ? targetCategory.order : 0,
      isFeatured: Boolean(targetCategory.isFeatured),
      isActive: targetCategory.isActive !== false,
      seoTitle: targetCategory.seoTitle || '',
      seoDescription: targetCategory.seoDescription || ''
    };

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.json({
      category,
      breadcrumb,
      children,
      descendantSlugs,
      descendantIds
    });
  } catch (err) {
    if (
      !isMongoConnected() ||
      err.name === 'MongoServerSelectionError' ||
      err.name === 'MongoNetworkError' ||
      err.name === 'MongoTimeoutError' ||
      err.name === 'MongooseError' ||
      err.message?.includes('buffering timed out') ||
      err.message?.includes('topology was destroyed') ||
      err.message?.includes('connection')
    ) {
      return res.status(503).json({
        success: false,
        message: 'Database service unavailable. MongoDB is not connected.',
        error: err.message
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve category by path',
      error: err.message
    });
  }
});

export default router;
export { router };
