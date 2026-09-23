import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.js';

/**
 * Middleware to verify JWT token
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'techcore_super_secret_jwt_key_2026';
    const decoded = jwt.verify(token, jwtSecret);

    let user = null;
    try {
      if (decoded.id) {
        user = await UserModel.findById(decoded.id).select('-password').lean();
      }
    } catch (e) {
      console.warn('UserModel lookup warning in auth middleware:', e.message);
    }

    if (!user) {
      if (decoded.role === 'SUPER_ADMIN' || decoded.email === 'techcoreadmin@gmail.com') {
        user = {
          _id: decoded.id || 'super_admin_id',
          name: 'TechCore Main Admin',
          email: decoded.email || 'techcoreadmin@gmail.com',
          role: 'SUPER_ADMIN',
          status: 'APPROVED'
        };
      } else if (decoded.role) {
        user = {
          _id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          status: 'APPROVED'
        };
      } else {
        return res.status(401).json({ message: 'User not found or token invalid.' });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('❌ Auth Verification Error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * Middleware: Requires Approved Admin (Super Admin OR Approved Co-Admin)
 * Blocks pending Co-Admins from product CRUD operation and ERP actions.
 */
export const requireApprovedAdmin = async (req, res, next) => {
  await verifyToken(req, res, () => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required. User context invalid.' });
    }

    // Super Admin is always approved
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Co-Admin must be APPROVED by Super Admin
    if (user.role === 'CO_ADMIN') {
      if (user.status === 'APPROVED') {
        return next();
      } else if (user.status === 'REJECTED') {
        return res.status(403).json({ 
          message: 'আপনার এডমিন রিকোয়েস্ট প্রত্যাখ্যান (REJECTED) করা হয়েছে। ড্যাশবোর্ডে এক্সেস নেই।' 
        });
      } else {
        return res.status(403).json({ 
          message: 'আপনার পারমিশন মুলতুবি (PENDING) অবস্থায় আছে! মেইন এডমিন (techcoreadmin@gmail.com) এর এপ্রুভালের জন্য অপেক্ষা করুন।' 
        });
      }
    }

    return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  });
};

/**
 * Middleware: Requires Super Admin privileges ONLY
 */
export const requireSuperAdmin = async (req, res, next) => {
  await verifyToken(req, res, () => {
    if (req.user && req.user.role === 'SUPER_ADMIN') {
      return next();
    }
    return res.status(403).json({ message: 'Access denied. Main Super Admin privileges required.' });
  });
};
