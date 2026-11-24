import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Admin } from '../models/Admin';

const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
};

export const seedDefaultAdmin = async (): Promise<void> => {
  try {
    // 1. Ensure default 'admin' exists if no account with role 'admin' exists
    const existingAdmin = await Admin.findOne({ role: 'admin' });
    if (!existingAdmin) {
      await Admin.create({
        username: 'admin',
        password: hashPassword('admin123'),
        role: 'admin',
      });
      console.log('=============================================');
      console.log('[Auth] Default Admin created: admin / admin123 (role: admin)');
      console.log('=============================================');
    }

    // 2. Ensure default 'superadmin' exists if no account with role 'superadmin' exists
    const existingSuperAdmin = await Admin.findOne({ role: 'superadmin' });
    if (!existingSuperAdmin) {
      await Admin.create({
        username: 'superadmin',
        password: hashPassword('superadmin123'),
        role: 'superadmin',
      });
      console.log('=============================================');
      console.log('[Auth] Default Super Admin created: superadmin / superadmin123 (role: superadmin)');
      console.log('=============================================');
    }
  } catch (error) {
    console.error('[Auth Error] Failed to seed default admin users:', error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Please enter both username and password' });
      return;
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const hashedPassword = hashPassword(cleanPassword);

    // Find admin user by username
    const admin = await Admin.findOne({ username: cleanUsername });

    if (!admin) {
      res.status(401).json({ success: false, error: 'Invalid username or password' });
      return;
    }

    // Verify password (check hashed or legacy plain)
    const isMatch = admin.password === hashedPassword || admin.password === cleanPassword;

    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid username or password' });
      return;
    }

    // If a specific role was requested from the UI (e.g. selected Admin vs Super Admin tab)
    if (role && role !== admin.role) {
      res.status(401).json({
        success: false,
        error: `This account does not have ${role === 'superadmin' ? 'Super Admin' : 'Admin'} permissions. Please switch role tab or check credentials.`,
      });
      return;
    }

    // Generate session token
    const token = crypto.randomBytes(32).toString('hex');

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const admin = await Admin.findOne().select('-password');
    res.status(200).json({ success: true, data: admin });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await Admin.find().select('-password');
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const updateUserCredentials = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roleParam = (req.params.role || req.body.role || '').toLowerCase().trim();
    const { username, password } = req.body;

    if (roleParam !== 'admin' && roleParam !== 'superadmin') {
      res.status(400).json({ success: false, error: 'Role must be either "admin" or "superadmin"' });
      return;
    }

    let user = await Admin.findOne({ role: roleParam });
    if (!user) {
      user = new Admin({ role: roleParam });
    }

    if (username && username.trim()) {
      const cleanUsername = username.trim().toLowerCase();
      // Ensure no conflict with another user
      const conflict = await Admin.findOne({ username: cleanUsername, _id: { $ne: user._id } });
      if (conflict) {
        res.status(400).json({
          success: false,
          error: `Username "${cleanUsername}" is already used by another account. Please choose a different username.`,
        });
        return;
      }
      user.username = cleanUsername;
    }

    if (password && password.trim()) {
      user.password = hashPassword(password.trim());
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: `${roleParam === 'superadmin' ? 'Super Admin' : 'Admin'} credentials updated successfully!`,
      data: {
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
