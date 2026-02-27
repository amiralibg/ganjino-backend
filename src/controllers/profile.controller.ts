import { Response } from 'express';
import { validationResult } from 'express-validator';
import Profile from '../models/Profile';
import { AuthRequest } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const profile = await Profile.findOne({ userId }).populate('userId', 'name email');

    if (!profile) {
      res.status(404).json({ error: MESSAGES.profile.notFound });
      return;
    }

    res.status(200).json({ profile });
  } catch (error: unknown) {
    console.error('GetProfile error:', error);
    res.status(500).json({ error: MESSAGES.profile.failedFetch });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.userId;
    const {
      monthlySalary,
      currency,
      monthlySavingsPercentage,
      notificationsEnabled,
      expoPushToken,
      goldPriceAlertThreshold,
    } = req.body as {
      monthlySalary?: number;
      currency?: string;
      monthlySavingsPercentage?: number;
      notificationsEnabled?: boolean;
      expoPushToken?: string;
      goldPriceAlertThreshold?: number;
    };

    let profile = await Profile.findOne({ userId });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = new Profile({
        userId,
        monthlySalary: Number(monthlySalary || 0),
        currency: currency || 'USD',
        monthlySavingsPercentage: Number(monthlySavingsPercentage || 20),
        notificationsEnabled: notificationsEnabled || false,
        expoPushToken: expoPushToken || undefined,
        goldPriceAlertThreshold: Number(goldPriceAlertThreshold || 0),
      });
    } else {
      // Update existing profile
      if (monthlySalary !== undefined) {
        profile.monthlySalary = Number(monthlySalary);
      }
      if (currency !== undefined) {
        profile.currency = currency;
      }
      if (monthlySavingsPercentage !== undefined) {
        profile.monthlySavingsPercentage = Number(monthlySavingsPercentage);
      }
      if (notificationsEnabled !== undefined) {
        profile.notificationsEnabled = Boolean(notificationsEnabled);
      }
      if (expoPushToken !== undefined) {
        profile.expoPushToken = expoPushToken || undefined;
      }
      if (goldPriceAlertThreshold !== undefined) {
        profile.goldPriceAlertThreshold = Number(goldPriceAlertThreshold);
      }
    }

    await profile.save();

    res.status(200).json({
      message: MESSAGES.profile.updatedSuccess,
      profile,
    });
  } catch (error: unknown) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({ error: MESSAGES.profile.failedUpdate });
  }
};
