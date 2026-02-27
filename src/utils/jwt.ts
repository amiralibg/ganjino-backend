import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { UserRole } from '../constants/roles';

const JWT_SECRET = env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15 minutes

const getJwtSecret = (): string => {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return JWT_SECRET;
};

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

export const generateRefreshToken = (): string => {
  // Generate cryptographically secure random token
  return crypto.randomBytes(64).toString('hex');
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
};

export const getRefreshTokenExpiryDate = (): Date => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now
  return expiryDate;
};
