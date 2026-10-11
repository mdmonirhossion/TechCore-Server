import mongoose from 'mongoose';
import { CategoryModel } from '../models/Category.js';
import { getCategoryFilterConfig } from '../config/filterConfig.js';

/**
 * Escapes special characters for use in regular expressions.
 * @param {string} string
 * @returns {string}
 */
export function escapeRegex(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a category by path, slug, or ID and retrieves all descendant IDs and slugs.
 *
 * @param {string} categoryPathOrSlug
 * @returns {Promise<{
 *   targetCategory: Object|null,
 *   descendantIds: string[],
 *   descendantSlugs: string[],
 *   categoryNames: string[]
 * }>}
 */
export async function resolveCategoryAndDescendants(categoryPathOrSlug) {
  if (!categoryPathOrSlug || typeof categoryPathOrSlug !== 'string') {
    return { targetCategory: null, descendantIds: [], descendantSlugs: [], categoryNames: [] };
  }

  const rawPath = categoryPathOrSlug.trim();
  const segments = rawPath.split('/').filter(Boolean).map(s => s.toLowerCase());

  if (segments.length === 0) {
    return { targetCategory: null, descendantIds: [], descendantSlugs: [], categoryNames: [] };
  }

  // If MongoDB is not active, return simple fallback
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return {
      targetCategory: null,
      descendantIds: [],
      descendantSlugs: [segments[segments.length - 1]],
      categoryNames: [segments[segments.length - 1]]
    };
  }

  const allCategories = await CategoryModel.find({ isActive: { $ne: false } }).lean();

  let currentParentId = null;
  let targetCategory = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    let matched = allCategories.find(c => {
      const parentMatches = currentParentId === null
        ? (!c.parent || c.parent === null)
        : (c.parent && c.parent.toString() === currentParentId.toString());
      return parentMatches && c.slug.toLowerCase() === seg;
    });

    // Fallback search by slug regardless of parent if single segment or direct match
    if (!matched && segments.length === 1) {
      matched = allCategories.find(c => c.slug.toLowerCase() === seg);
    }

    if (!matched) {
      // Check prefix/suffix/alias
      matched = allCategories.find(c => {
        const parentMatches = currentParentId === null
          ? (!c.parent || c.parent === null)
          : (c.parent && c.parent.toString() === currentParentId.toString());
        if (!parentMatches && segments.length > 1) return false;
        const cSlug = c.slug.toLowerCase();
        return cSlug === seg || cSlug.startsWith(seg + '-') || cSlug.endsWith('-' + seg);
      });
    }

    if (!matched) {
      return { targetCategory: null, descendantIds: [], descendantSlugs: [], categoryNames: [] };
    }

    currentParentId = matched._id;
    targetCategory = matched;
  }

  if (!targetCategory) {
    return { targetCategory: null, descendantIds: [], descendantSlugs: [], categoryNames: [] };
  }

  // Collect all descendants recursively
  const descendantIds = [targetCategory._id.toString()];
  const descendantSlugs = [targetCategory.slug];
  const categoryNames = [targetCategory.name];
  const queue = [targetCategory._id.toString()];

  while (queue.length > 0) {
    const parentIdStr = queue.shift();
    for (const cat of allCategories) {
      if (cat.parent && cat.parent.toString() === parentIdStr) {
        const catIdStr = cat._id.toString();
        descendantIds.push(catIdStr);
        descendantSlugs.push(cat.slug);
        categoryNames.push(cat.name);
        queue.push(catIdStr);
      }
    }
  }

  return {
    targetCategory,
    descendantIds,
    descendantSlugs,
    categoryNames
  };
}

/**
 * Builds MongoDB query, sorting, pagination, and context for products catalog.
 *
 * @param {Object} query - req.query object
 * @param {Object} [options]
 * @param {string[]} [options.descendantSlugs]
 * @param {string[]} [options.descendantIds]
 * @returns {Promise<{
 *   mongoQuery: Object,
 *   sortOptions: Object,
 *   page: number,
 *   limit: number,
 *   skip: number,
 *   resolvedCategoryContext: Object
 * }>}
 */
export async function buildProductQuery(query = {}, { descendantSlugs, descendantIds } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const {
    category,
    brand,
    search,
    minPrice,
    maxPrice,
    inStock,
    stockStatus,
    emi,
    isFlashSale,
    isFeatured,
    sort
  } = query;

  const andConditions = [];

  // 1. Category Resolution & Filtering
  let resolvedSlugs = Array.isArray(descendantSlugs) ? descendantSlugs : null;
  let resolvedIds = Array.isArray(descendantIds) ? descendantIds : null;
  let resolvedNames = [];
  let targetCat = null;

  if (category) {
    if (!resolvedSlugs || !resolvedIds) {
      const res = await resolveCategoryAndDescendants(category);
      targetCat = res.targetCategory;
      resolvedIds = res.descendantIds;
      resolvedSlugs = res.descendantSlugs;
      resolvedNames = res.categoryNames;
    }

    const categoryOrConditions = [];

    // Match categoryId if ObjectIds exist
    if (resolvedIds && resolvedIds.length > 0) {
      const validObjectIds = resolvedIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (validObjectIds.length > 0) {
        categoryOrConditions.push({ categoryId: { $in: validObjectIds } });
      }
    }

    // Match categorySlug in descendant slugs
    if (resolvedSlugs && resolvedSlugs.length > 0) {
      categoryOrConditions.push({ categorySlug: { $in: resolvedSlugs } });
    }

    // Match normalised category name
    if (resolvedNames && resolvedNames.length > 0) {
      const escapedNames = resolvedNames.map(n => new RegExp(`^${escapeRegex(n)}$`, 'i'));
      categoryOrConditions.push({ category: { $in: escapedNames } });
    }

    // Direct fallback for single string category param
    const catTrimmed = category.trim();
    categoryOrConditions.push({ categorySlug: catTrimmed.toLowerCase() });
    categoryOrConditions.push({ category: new RegExp(`^${escapeRegex(catTrimmed)}$`, 'i') });

    andConditions.push({ $or: categoryOrConditions });
  }

  // 2. Brand Comma List (case-insensitive exact)
  if (brand) {
    const brands = brand
      .split(',')
      .map(b => b.trim())
      .filter(Boolean);

    if (brands.length === 1) {
      andConditions.push({ brand: new RegExp(`^${escapeRegex(brands[0])}$`, 'i') });
    } else if (brands.length > 1) {
      const brandRegexes = brands.map(b => new RegExp(`^${escapeRegex(b)}$`, 'i'));
      andConditions.push({ brand: { $in: brandRegexes } });
    }
  }

  // 3. Stock Status Comma List
  if (stockStatus) {
    const statuses = stockStatus
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    if (statuses.length > 0) {
      andConditions.push({ stockStatus: { $in: statuses } });
    }
  }

  // 4. inStock=true (does NOT overwrite other conditions)
  if (inStock === 'true') {
    andConditions.push({
      $or: [
        { stock: { $gt: 0 } },
        { stockStatus: 'IN_STOCK' }
      ]
    });
  }

  // 5. Effective Price (discountPrice when set and > 0, else price)
  const min = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
  const max = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;

  if (min !== null || max !== null) {
    const effectivePriceExpr = {
      $cond: [
        { $and: [{ $ne: ['$discountPrice', null] }, { $gt: ['$discountPrice', 0] }] },
        '$discountPrice',
        '$price'
      ]
    };

    const priceExprs = [];
    if (min !== null) priceExprs.push({ $gte: [effectivePriceExpr, min] });
    if (max !== null) priceExprs.push({ $lte: [effectivePriceExpr, max] });

    if (priceExprs.length === 1) {
      andConditions.push({ $expr: priceExprs[0] });
    } else if (priceExprs.length > 1) {
      andConditions.push({ $expr: { $and: priceExprs } });
    }
  }

  // 6. Search Filter
  if (search && search.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
    andConditions.push({
      $or: [
        { name: searchRegex },
        { brand: searchRegex },
        { category: searchRegex },
        { tags: searchRegex },
        { sku: searchRegex }
      ]
    });
  }

  // 7. Boolean Flags
  if (emi === 'true') {
    andConditions.push({ emiAvailable: true });
  }

  if (isFlashSale === 'true') {
    andConditions.push({ isFlashSale: true });
  }

  if (isFeatured === 'true') {
    andConditions.push({ isFeatured: true });
  }

  // 8. Specifications Filters (spec_<key>=val1,val2)
  // Whitelist keys per category from filterConfig.js
  const categoryIdentifier = category || (resolvedSlugs && resolvedSlugs[0]) || '';
  const allowedSpecConfigs = getCategoryFilterConfig(categoryIdentifier);
  const allowedKeysMap = new Map(allowedSpecConfigs.map(s => [s.key.toLowerCase(), s.key]));

  for (const [paramKey, paramVal] of Object.entries(query)) {
    if (!paramKey.startsWith('spec_') || !paramVal) continue;

    const rawKey = paramKey.slice(5).trim();
    const matchedKey = allowedKeysMap.get(rawKey.toLowerCase());

    // Ignore unknown or non-whitelisted spec keys
    if (!matchedKey) continue;

    const values = String(paramVal)
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    if (values.length === 0) continue;

    // OR within one key: regex match on specifications.<key>
    const regexes = values.map(v => new RegExp(`^${escapeRegex(v)}$`, 'i'));
    andConditions.push({
      [`specifications.${matchedKey}`]: { $in: regexes }
    });
  }

  // 9. Sorting
  let sortOptions = { createdAt: -1 };
  if (sort === 'price_asc') sortOptions = { price: 1 };
  else if (sort === 'price_desc') sortOptions = { price: -1 };
  else if (sort === 'rating') sortOptions = { rating: -1 };
  else if (sort === 'newest') sortOptions = { createdAt: -1 };

  const mongoQuery = andConditions.length > 0 ? { $and: andConditions } : {};

  return {
    mongoQuery,
    sortOptions,
    page,
    limit,
    skip,
    resolvedCategoryContext: {
      targetCategory: targetCat,
      descendantIds: resolvedIds || [],
      descendantSlugs: resolvedSlugs || [],
      categoryNames: resolvedNames || []
    }
  };
}

/**
 * In-memory fallback filter matching the same semantics when MongoDB is offline.
 *
 * @param {Array} products
 * @param {Object} query
 * @param {Object} [categoryContext]
 * @returns {Array}
 */
export function filterInMemoryProducts(products = [], query = {}, categoryContext = {}) {
  const {
    category,
    brand,
    search,
    minPrice,
    maxPrice,
    inStock,
    stockStatus,
    emi,
    isFlashSale,
    isFeatured
  } = query;

  let filtered = [...products];

  if (category) {
    const slugs = new Set((categoryContext.descendantSlugs || [category]).map(s => s.toLowerCase()));
    const ids = new Set((categoryContext.descendantIds || []).map(String));
    const catLower = category.toLowerCase();

    filtered = filtered.filter(p => {
      if (p.categoryId && ids.has(String(p.categoryId))) return true;
      if (p.categorySlug && slugs.has(p.categorySlug.toLowerCase())) return true;
      if (p.category && (slugs.has(p.category.toLowerCase()) || p.category.toLowerCase() === catLower)) return true;
      return false;
    });
  }

  if (brand) {
    const brands = brand.split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
    filtered = filtered.filter(p => p.brand && brands.includes(p.brand.toLowerCase()));
  }

  if (stockStatus) {
    const statuses = stockStatus.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    filtered = filtered.filter(p => statuses.includes((p.stockStatus || '').toUpperCase()));
  }

  if (inStock === 'true') {
    filtered = filtered.filter(p => (Number(p.stock) > 0 || p.stockStatus === 'IN_STOCK'));
  }

  const min = minPrice !== undefined && minPrice !== '' ? Number(minPrice) : null;
  const max = maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : null;
  if (min !== null || max !== null) {
    filtered = filtered.filter(p => {
      const eff = p.discountPrice && p.discountPrice > 0 ? p.discountPrice : p.price;
      if (min !== null && eff < min) return false;
      if (max !== null && eff > max) return false;
      return true;
    });
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }

  if (emi === 'true') {
    filtered = filtered.filter(p => p.emiAvailable === true);
  }
  if (isFlashSale === 'true') {
    filtered = filtered.filter(p => p.isFlashSale === true);
  }
  if (isFeatured === 'true') {
    filtered = filtered.filter(p => p.isFeatured === true);
  }

  return filtered;
}
