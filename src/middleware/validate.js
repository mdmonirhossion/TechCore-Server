import { z } from 'zod';

/**
 * Express middleware to validate request body against a Zod schema.
 * Automatically sanitizes and replaces req.body with the validated data.
 * Returns formatted 400 response with detailed field errors if validation fails.
 *
 * @param {import('zod').ZodSchema} schema
 */
export const validateBody = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => {
        const fieldName = issue.path.join('.');
        return {
          field: fieldName || 'body',
          message: issue.message
        };
      });

      return res.status(400).json({
        success: false,
        message: 'ভ্যালিডেশন এরর: সঠিক তথ্য প্রদান করুন',
        errors: formattedErrors
      });
    }

    req.body = result.data;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Express middleware to validate query parameters against a Zod schema.
 */
export const validateQuery = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'query',
        message: issue.message
      }));

      return res.status(400).json({
        success: false,
        message: 'কুয়েরি প্যারামিটার ভ্যালিডেশন ব্যর্থ হয়েছে',
        errors: formattedErrors
      });
    }

    req.query = result.data;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Express middleware to validate route params against a Zod schema.
 */
export const validateParams = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const formattedErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'param',
        message: issue.message
      }));

      return res.status(400).json({
        success: false,
        message: 'ইউআরএল প্যারামিটার ভ্যালিডেশন ব্যর্থ হয়েছে',
        errors: formattedErrors
      });
    }

    req.params = result.data;
    next();
  } catch (err) {
    next(err);
  }
};

export default {
  validateBody,
  validateQuery,
  validateParams
};
