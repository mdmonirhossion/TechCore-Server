/**
 * Utility to convert string names to URL-safe unique slugs
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Generate a unique slug in a Mongoose model collection by appending a counter if duplicate exists
 */
export async function generateUniqueSlug(Model, baseName, currentId = null) {
  const baseSlug = slugify(baseName) || 'item';
  let slug = baseSlug;
  let count = 1;

  while (true) {
    const query = { slug };
    if (currentId) {
      query._id = { $ne: currentId };
    }
    const existing = await Model.findOne(query).lean();
    if (!existing) {
      break;
    }
    count++;
    slug = `${baseSlug}-${count}`;
  }

  return slug;
}
