import { z } from 'zod';

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'প্রোডাক্টের নাম প্রদান করা বাধ্যতামূলক' })
    .min(3, 'প্রোডাক্টের নাম কমপক্ষে ৩ অক্ষরের হতে হবে')
    .trim(),
  price: z.coerce
    .number({ required_error: 'মূল্য প্রদান করা বাধ্যতামূলক' })
    .positive('মূল্য ০ এর চেয়ে বেশি হতে হবে'),
  discountPrice: z.coerce
    .number()
    .nonnegative('ডিসকাউন্ট মূল্য ঋণাত্মক হতে পারে না')
    .optional(),
  brand: z.string().optional().default('Generic'),
  category: z.string().optional().default('General'),
  categorySlug: z.string().optional(),
  builderCategory: z.string().optional(),
  stock: z.coerce.number().int().nonnegative().optional().default(10),
  stockStatus: z
    .enum(['IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'UP_COMING'])
    .optional()
    .default('IN_STOCK'),
  images: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(''),
  warranty: z.string().optional().default('1 Year'),
  sku: z.string().optional(),
  slug: z.string().optional(),
  isFlashSale: z.boolean().optional().default(false),
  flashSalePrice: z.coerce.number().optional(),
  emiAvailable: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
  badge: z.string().optional().default(''),
  keyFeatures: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([])
});

export const updateProductSchema = createProductSchema.partial();

export default {
  createProductSchema,
  updateProductSchema
};
