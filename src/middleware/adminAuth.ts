import { Response, NextFunction } from 'express';
import User from '../models/User';
import { AuthRequest } from './auth';
import { MESSAGES } from '../constants/messages';
import { AdminPermission, hasAdminPermission, isAdminRole } from '../constants/roles';

const loadAndValidateAdminUser = async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: MESSAGES.common.unauthorized });
    return null;
  }

  const user = await User.findById(userId);

  if (!user) {
    res.status(404).json({ error: MESSAGES.common.userNotFound });
    return null;
  }

  if (!isAdminRole(user.role)) {
    res.status(403).json({ error: MESSAGES.admin.forbiddenAdminAccess });
    return null;
  }

  if (!user.isActive) {
    res.status(403).json({ error: MESSAGES.common.accountDeactivated });
    return null;
  }

  req.userRole = user.role;
  return user;
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await loadAndValidateAdminUser(req, res);
    if (!user) {
      return;
    }

    next();
  } catch (error: unknown) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: MESSAGES.common.internalServerError });
  }
};

export const requireSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await loadAndValidateAdminUser(req, res);
    if (!user) {
      return;
    }

    if (user.role !== 'super_admin') {
      res.status(403).json({ error: MESSAGES.admin.forbiddenSuperAdminAccess });
      return;
    }

    next();
  } catch (error: unknown) {
    console.error('Super admin auth error:', error);
    res.status(500).json({ error: MESSAGES.common.internalServerError });
  }
};

export const requireAdminPermission =
  (permission: AdminPermission) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const role = req.userRole;
      if (!role || !isAdminRole(role)) {
        res.status(403).json({ error: MESSAGES.admin.forbiddenAdminAccess });
        return;
      }

      if (!hasAdminPermission(role, permission)) {
        res.status(403).json({ error: MESSAGES.admin.forbiddenPermissionAccess });
        return;
      }

      next();
    } catch (error: unknown) {
      console.error('Admin permission auth error:', error);
      res.status(500).json({ error: MESSAGES.common.internalServerError });
    }
  };
