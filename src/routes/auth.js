import express from 'express';
import { validateBody } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validations/authValidation.js';
import { registerUser, loginUser } from '../controllers/authController.js';

export const createAuthRouter = (rateLimiter, usersStore = []) => {
  const router = express.Router();

  const middleware = rateLimiter ? [rateLimiter] : [];

  router.post('/register', ...middleware, validateBody(registerSchema), (req, res) => {
    return registerUser(req, res, usersStore);
  });

  router.post('/login', ...middleware, validateBody(loginSchema), (req, res) => {
    return loginUser(req, res, usersStore);
  });

  return router;
};

export default createAuthRouter;
