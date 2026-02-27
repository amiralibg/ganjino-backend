import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import Profile from '../models/Profile';
import RefreshToken, { DeviceInfo } from '../models/RefreshToken';
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiryDate } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';

interface DeviceInfoRequest {
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  osVersion?: string;
}

// Helper to extract device and security info
const getDeviceInfo = (req: Request): DeviceInfo => {
  const body = req.body as DeviceInfoRequest;
  const deviceId = String(body.deviceId || req.headers['x-device-id'] || 'unknown');
  const deviceName = String(body.deviceName || req.headers['x-device-name'] || 'Unknown Device');
  const platform = String(body.platform || req.headers['x-platform'] || 'web');
  const appVersion = body.appVersion || req.headers['x-app-version'];
  const osVersion = body.osVersion || req.headers['x-os-version'];

  return {
    deviceId,
    deviceName,
    platform: platform as 'ios' | 'android' | 'web',
    appVersion: appVersion ? String(appVersion) : undefined,
    osVersion: osVersion ? String(osVersion) : undefined,
  };
};

const getSecurityInfo = (req: Request) => {
  return {
    ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
    userAgent: req.headers['user-agent'],
    lastUsedAt: new Date(),
    usageCount: 1,
    suspiciousActivity: false,
  };
};

// Check for suspicious activity
const detectSuspiciousActivity = async (
  userId: string,
  _deviceInfo: DeviceInfo
): Promise<boolean> => {
  // Check if there are too many active tokens from different devices
  const activeTokens = await RefreshToken.find({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  });

  // Suspicious if more than 5 active sessions
  if (activeTokens.length > 5) {
    return true;
  }

  // Check for rapid device changes
  const recentTokens = await RefreshToken.find({
    userId,
    createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
  });

  const uniqueDevices = new Set(recentTokens.map((t) => t.deviceInfo.deviceId));
  if (uniqueDevices.size > 3) {
    return true;
  }

  return false;
};

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name: string;
    };

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: MESSAGES.auth.userAlreadyExists });
      return;
    }

    // Create user
    const user = new User({
      email,
      password,
      name,
    });

    await user.save();

    // Create profile for the user
    const profile = new Profile({
      userId: user._id,
    });

    await profile.save();

    // Get device and security info
    const deviceInfo = getDeviceInfo(req);
    const securityInfo = getSecurityInfo(req);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    const refreshTokenString = generateRefreshToken();

    // Save refresh token to database
    const refreshToken = new RefreshToken({
      userId: user._id,
      token: refreshTokenString,
      expiresAt: getRefreshTokenExpiryDate(),
      deviceInfo,
      securityInfo,
    });

    await refreshToken.save();

    res.status(201).json({
      message: MESSAGES.auth.signUpSuccess,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken: refreshTokenString,
    });
  } catch (error: unknown) {
    console.error('SignUp error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedCreateUser });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body as { email: string; password: string };

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: MESSAGES.auth.invalidCredentials });
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      res.status(403).json({ error: MESSAGES.common.accountDeactivated });
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(String(password));
    if (!isPasswordValid) {
      res.status(401).json({ error: MESSAGES.auth.invalidCredentials });
      return;
    }

    // Get device and security info
    const deviceInfo = getDeviceInfo(req);
    const securityInfo = getSecurityInfo(req);

    // Check for suspicious activity
    const isSuspicious = await detectSuspiciousActivity(String(user._id), deviceInfo);
    securityInfo.suspiciousActivity = isSuspicious;

    // Revoke old token from same device if exists
    await RefreshToken.updateMany(
      {
        userId: user._id,
        'deviceInfo.deviceId': deviceInfo.deviceId,
        isRevoked: false,
      },
      {
        $set: { isRevoked: true, revokedAt: new Date() },
      }
    );

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    const refreshTokenString = generateRefreshToken();

    // Save refresh token to database
    const refreshToken = new RefreshToken({
      userId: user._id,
      token: refreshTokenString,
      expiresAt: getRefreshTokenExpiryDate(),
      deviceInfo,
      securityInfo,
    });

    await refreshToken.save();

    res.status(200).json({
      message: MESSAGES.auth.signInSuccess,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken: refreshTokenString,
      warning: isSuspicious ? MESSAGES.auth.suspiciousActivityDetected : undefined,
    });
  } catch (error: unknown) {
    console.error('SignIn error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedSignIn });
  }
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json({ error: MESSAGES.auth.refreshTokenRequired });
      return;
    }

    // Find refresh token in database
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      isRevoked: false,
    });

    if (!storedToken) {
      res.status(401).json({ error: MESSAGES.auth.invalidRefreshToken });
      return;
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      res.status(401).json({ error: MESSAGES.auth.refreshTokenExpired });
      return;
    }

    // Find user
    const user = await User.findById(storedToken.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ error: MESSAGES.auth.userNotFoundOrInactive });
      return;
    }

    // Update security info
    storedToken.securityInfo.lastUsedAt = new Date();
    storedToken.securityInfo.usageCount += 1;
    storedToken.securityInfo.ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);

    // REFRESH TOKEN ROTATION: Generate new refresh token
    const newRefreshTokenString = generateRefreshToken();

    // Mark old token as replaced
    storedToken.isRevoked = true;
    storedToken.revokedAt = new Date();
    storedToken.replacedByToken = newRefreshTokenString;
    await storedToken.save();

    // Create new refresh token
    const newRefreshToken = new RefreshToken({
      userId: storedToken.userId,
      token: newRefreshTokenString,
      expiresAt: getRefreshTokenExpiryDate(),
      deviceInfo: storedToken.deviceInfo,
      securityInfo: {
        ipAddress: storedToken.securityInfo.ipAddress,
        userAgent: storedToken.securityInfo.userAgent,
        suspiciousActivity: storedToken.securityInfo.suspiciousActivity,
        lastUsedAt: new Date(),
        usageCount: 0,
      },
    });

    await newRefreshToken.save();

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: String(user._id),
      email: user.email,
      role: user.role,
    });

    res.status(200).json({
      accessToken,
      refreshToken: newRefreshTokenString, // Return new refresh token
    });
  } catch (error: unknown) {
    console.error('RefreshToken error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedRefreshToken });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      res.status(400).json({ error: MESSAGES.auth.refreshTokenRequired });
      return;
    }

    // Find and revoke refresh token
    const storedToken = await RefreshToken.findOne({ token: refreshToken });

    if (storedToken) {
      storedToken.isRevoked = true;
      storedToken.revokedAt = new Date();
      await storedToken.save();
    }

    res.status(200).json({ message: MESSAGES.auth.logoutSuccess });
  } catch (error: unknown) {
    console.error('Logout error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedLogout });
  }
};

export const logoutAllDevices = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: MESSAGES.common.unauthorized });
      return;
    }

    // Revoke all refresh tokens for this user
    const result = await RefreshToken.updateMany(
      {
        userId,
        isRevoked: false,
      },
      {
        $set: {
          isRevoked: true,
          revokedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      message: MESSAGES.auth.logoutAllDevicesSuccess,
      revokedCount: result.modifiedCount,
    });
  } catch (error: unknown) {
    console.error('LogoutAllDevices error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedLogoutAllDevices });
  }
};

export const getActiveSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: MESSAGES.common.unauthorized });
      return;
    }

    const activeSessions = await RefreshToken.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .select('-token -userId')
      .sort({ 'securityInfo.lastUsedAt': -1 });

    res.status(200).json({
      sessions: activeSessions.map((session) => ({
        id: session._id,
        device: session.deviceInfo,
        lastUsed: session.securityInfo.lastUsedAt,
        usageCount: session.securityInfo.usageCount,
        suspicious: session.securityInfo.suspiciousActivity,
        createdAt: session.createdAt,
      })),
    });
  } catch (error: unknown) {
    console.error('GetActiveSessions error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedGetActiveSessions });
  }
};

export const revokeSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;

    if (!userId) {
      res.status(401).json({ error: MESSAGES.common.unauthorized });
      return;
    }

    const session = await RefreshToken.findOne({
      _id: sessionId,
      userId,
    });

    if (!session) {
      res.status(404).json({ error: MESSAGES.auth.sessionNotFound });
      return;
    }

    session.isRevoked = true;
    session.revokedAt = new Date();
    await session.save();

    res.status(200).json({ message: MESSAGES.auth.sessionRevokedSuccess });
  } catch (error: unknown) {
    console.error('RevokeSession error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedRevokeSession });
  }
};

export const validateToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // If we reach here, the token is valid (verified by authenticateToken middleware)
    const userId = req.userId;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ error: MESSAGES.common.userNotFound });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: MESSAGES.common.accountDeactivated });
      return;
    }

    res.status(200).json({
      valid: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error('ValidateToken error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedValidateToken });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ error: MESSAGES.common.userNotFound });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error: unknown) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: MESSAGES.auth.failedGetUser });
  }
};
