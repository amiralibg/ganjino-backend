import { Response } from 'express';
import User from '../models/User';
import Goal from '../models/Goal';
import RefreshToken from '../models/RefreshToken';
import { AuthRequest } from '../middleware/auth';
import { FilterQuery } from 'mongoose';
import { IUser } from '../models/User';
import { MESSAGES } from '../constants/messages';

export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, role, status, sortBy = 'createdAt', sortOrder = 'desc' } =
      req.query;
    const query: FilterQuery<IUser> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
      ];
    }

    if (role && role !== 'all') {
      query.role = role as IUser['role'];
    }

    if (status && status !== 'all') {
      query.isActive = status === 'active';
    }

    const resolvedSortBy = String(sortBy);
    const resolvedSortOrder = sortOrder === 'asc' ? 1 : -1;
    const sortFieldMap: Record<string, 'createdAt' | 'name' | 'email'> = {
      createdAt: 'createdAt',
      name: 'name',
      email: 'email',
    };
    const sortField = sortFieldMap[resolvedSortBy] || 'createdAt';

    const users = await User.find(query)
      .select('-password')
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .sort({ [sortField]: resolvedSortOrder });

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
    res.status(500).json({ error: MESSAGES.admin.failedFetchUsers });
  }
};

export const getUserDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      res.status(404).json({ error: MESSAGES.common.userNotFound });
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
    res.status(500).json({ error: MESSAGES.admin.failedFetchUserDetails });
  }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: MESSAGES.common.userNotFound });
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
      message: MESSAGES.admin.userStatusUpdatedSuccess,
      user: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (error: unknown) {
    console.error('ToggleUserStatus error:', error);
    res.status(500).json({ error: MESSAGES.admin.failedUpdateUserStatus });
  }
};

export const promoteToAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: MESSAGES.common.userNotFound });
      return;
    }

    if (user.role === 'super_admin') {
      res.status(400).json({ error: MESSAGES.admin.failedPromoteUser });
      return;
    }

    user.role = 'admin';
    await user.save();

    res.status(200).json({
      message: MESSAGES.admin.userPromotedSuccess,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error('PromoteToAdmin error:', error);
    res.status(500).json({ error: MESSAGES.admin.failedPromoteUser });
  }
};

export const demoteAdminToUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: MESSAGES.common.userNotFound });
      return;
    }

    if (user.role === 'super_admin') {
      res.status(400).json({ error: MESSAGES.admin.cannotDemoteSuperAdmin });
      return;
    }

    user.role = 'user';
    await user.save();

    res.status(200).json({
      message: MESSAGES.admin.userDemotedSuccess,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: unknown) {
    console.error('DemoteAdminToUser error:', error);
    res.status(500).json({ error: MESSAGES.admin.failedDemoteUser });
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

    const timelineMap = new Map<string, number>();
    for (let i = 23; i >= 0; i -= 1) {
      const hourDate = new Date();
      hourDate.setMinutes(0, 0, 0);
      hourDate.setHours(hourDate.getHours() - i);
      const hourKey = `${hourDate.getFullYear()}-${hourDate.getMonth()}-${hourDate.getDate()}-${hourDate.getHours()}`;
      timelineMap.set(hourKey, 0);
    }
    for (const login of recentLogins) {
      const created = new Date(login.createdAt);
      created.setMinutes(0, 0, 0);
      const hourKey = `${created.getFullYear()}-${created.getMonth()}-${created.getDate()}-${created.getHours()}`;
      if (timelineMap.has(hourKey)) {
        timelineMap.set(hourKey, (timelineMap.get(hourKey) || 0) + 1);
      }
    }
    const loginTimeline24h = Array.from(timelineMap.entries()).map(([key, count]) => {
      const parts = key.split('-');
      const hour = Number(parts[3]);
      return {
        label: `${String(hour).padStart(2, '0')}:00`,
        count,
      };
    });

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
      loginTimeline24h,
    });
  } catch (error: unknown) {
    console.error('GetSecurityInsights error:', error);
    res.status(500).json({ error: MESSAGES.admin.failedFetchSecurityInsights });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const admins = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] } });
    const superAdmins = await User.countDocuments({ role: 'super_admin' });
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
        superAdmins,
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
    res.status(500).json({ error: MESSAGES.admin.failedFetchDashboardStats });
  }
};
