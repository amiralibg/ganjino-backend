import { Response } from 'express';
import User from '../models/User';
import Goal from '../models/Goal';
import RefreshToken from '../models/RefreshToken';
import { AuthRequest } from '../middleware/auth';
import { FilterQuery } from 'mongoose';
import { IUser } from '../models/User';

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const query: FilterQuery<IUser> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: unknown) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const activeSessions = await RefreshToken.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    }).select('-token');

    const goalCount = await Goal.countDocuments({ userId });

    res.status(200).json({
      user,
      stats: {
        activeSessions: activeSessions.length,
        goalCount,
      },
      sessions: activeSessions,
    });
  } catch (error: unknown) {
    console.error('GetUserDetails error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    if (!user.isActive) {
      await RefreshToken.updateMany(
        { userId, isRevoked: false },
        { $set: { isRevoked: true, revokedAt: new Date() } }
      );
    }

    res.status(200).json({
      message: 'User status updated successfully',
      user: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (error: unknown) {
    console.error('ToggleUserStatus error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

export const promoteToAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    user.role = 'admin';
    await user.save();

    res.status(200).json({
      message: 'User promoted to admin successfully',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error('PromoteToAdmin error:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
};

export const getSecurityInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const suspiciousSessions = await RefreshToken.find({
      'securityInfo.suspiciousActivity': true,
      isRevoked: false,
    })
      .populate('userId', 'email name')
      .limit(50);

    const recentLogins = await RefreshToken.find({
      createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
      .populate('userId', 'email name')
      .sort({ createdAt: -1 })
      .limit(100);

    const stats = {
      totalActiveSessions: await RefreshToken.countDocuments({
        isRevoked: false,
        expiresAt: { $gt: new Date() },
      }),
      suspiciousSessions: suspiciousSessions.length,
      last24hLogins: recentLogins.length,
    };

    res.status(200).json({
      stats,
      suspiciousSessions,
      recentLogins,
    });
  } catch (error: unknown) {
    console.error('GetSecurityInsights error:', error);
    res.status(500).json({ error: 'Failed to fetch security insights' });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const admins = await User.countDocuments({ role: 'admin' });
    const totalGoals = await Goal.countDocuments();
    const wishlistedGoals = await Goal.countDocuments({ isWishlisted: true });
    const activeSessions = await RefreshToken.countDocuments({
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    });

    res.status(200).json({
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        admins,
      },
      goals: {
        total: totalGoals,
        wishlisted: wishlistedGoals,
      },
      sessions: {
        active: activeSessions,
      },
    });
  } catch (error: unknown) {
    console.error('GetDashboardStats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};
