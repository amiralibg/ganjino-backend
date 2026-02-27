import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { MESSAGES } from '../constants/messages';
import { UserRole } from '../constants/roles';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: MESSAGES.auth.accessTokenRequired });
      return;
    }

    const decoded = verifyAccessToken(token);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;

    next();
  } catch {
    res.status(403).json({ error: MESSAGES.auth.invalidOrExpiredToken });
  }
};
