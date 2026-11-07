import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { UserModel } from '../models/User.js';

export const registerUser = async (req, res, usersStore = []) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    if (process.env.ADMIN_EMAIL && normalizedEmail === process.env.ADMIN_EMAIL.toLowerCase().trim()) {
      return res.status(400).json({ message: 'This email is reserved for the Main Super Admin.' });
    }

    const isConnected = mongoose.connection.readyState === 1;

    let existing = null;
    if (isConnected) {
      existing = await UserModel.findOne({ email: normalizedEmail });
    } else {
      existing = usersStore.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
    }

    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const requestedRole = role === 'CO_ADMIN' ? 'CO_ADMIN' : 'USER';
    const initialStatus = requestedRole === 'CO_ADMIN' ? 'PENDING' : 'APPROVED';

    let newUser = null;
    if (isConnected) {
      newUser = await UserModel.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: requestedRole,
        status: initialStatus,
        phone
      });
    } else {
      newUser = {
        _id: 'usr-' + Date.now(),
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: requestedRole,
        status: initialStatus,
        phone,
        createdAt: new Date().toISOString()
      };
      usersStore.push(newUser);
    }

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role, email: newUser.email },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: requestedRole === 'CO_ADMIN'
        ? 'Co-Admin registration submitted! Awaiting Main Admin approval.'
        : 'Registration successful!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        phone: newUser.phone
      }
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
};

export const loginUser = async (req, res, usersStore = []) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    let user = null;

    const isConnected = mongoose.connection.readyState === 1;

    if (isConnected) {
      user = await UserModel.findOne({ email: normalizedEmail });
    } else {
      user = usersStore.find(u => u.email && u.email.toLowerCase() === normalizedEmail);
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (user.role === 'CO_ADMIN' && user.status !== 'APPROVED') {
      return res.status(403).json({ message: 'Your Co-Admin account is pending admin approval.' });
    }

    let isMatch = false;
    if (user.password) {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: user._id || user.id, role: user.role, email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

export default {
  registerUser,
  loginUser
};
