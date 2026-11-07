import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'নাম প্রদান করা বাধ্যতামূলক' })
    .min(2, 'নাম কমপক্ষে ২ অক্ষরের হতে হবে')
    .max(100, 'নাম সর্বোচ্চ ১০০ অক্ষরের হতে পারে')
    .trim(),
  email: z
    .string({ required_error: 'ইমেইল প্রদান করা বাধ্যতামূলক' })
    .email('একটি সঠিক ইমেইল এড্রেস প্রদান করুন')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'পাসওয়ার্ড প্রদান করা বাধ্যতামূলক' })
    .min(6, 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে')
    .max(128, 'পাসওয়ার্ড সর্বোচ্চ ১২৮ অক্ষরের হতে পারে'),
  phone: z
    .string()
    .optional()
    .transform((val) => (val ? val.trim() : val)),
  role: z
    .enum(['USER', 'CO_ADMIN', 'CUSTOMER'], {
      errorMap: () => ({ message: 'অবৈধ রোল নির্বাচিত হয়েছে' })
    })
    .optional()
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'ইমেইল প্রদান করা বাধ্যতামূলক' })
    .email('একটি সঠিক ইমেইল এড্রেস প্রদান করুন')
    .trim()
    .toLowerCase(),
  password: z
    .string({ required_error: 'পাসওয়ার্ড প্রদান করা বাধ্যতামূলক' })
    .min(1, 'পাসওয়ার্ড ফিল্ড খালি রাখা যাবে না')
});

export default {
  registerSchema,
  loginSchema
};
