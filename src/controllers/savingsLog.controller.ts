import { Response } from 'express';
import { validationResult } from 'express-validator';
import mongoose, { FilterQuery } from 'mongoose';
import SavingsLog, { ISavingsLog } from '../models/SavingsLog';
import Goal from '../models/Goal';
import { AuthRequest } from '../middleware/auth';

/**
 * Create a new savings log entry
 */
export const createSavingsLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.userId;
    const { amount, type, goalId, note, date } = req.body as {
      amount: number;
      type?: string;
      goalId?: string;
      note?: string;
      date?: string;
    };

    // Validate goalId if provided
    if (goalId) {
      const goal = await Goal.findOne({ _id: goalId, userId });
      if (!goal) {
        res.status(404).json({ error: 'Goal not found' });
        return;
      }
    }

    const savingsLog = new SavingsLog({
      userId,
      amount: Number(amount),
      type: type || 'money',
      goalId: goalId || undefined,
      note: note || undefined,
      date: date ? new Date(String(date)) : new Date(),
    });

    await savingsLog.save();

    res.status(201).json({
      message: 'Savings log created successfully',
      savingsLog,
    });
  } catch (error: unknown) {
    console.error('CreateSavingsLog error:', error);
    res.status(500).json({ error: 'Failed to create savings log' });
  }
};

/**
 * Get all savings logs for the authenticated user
 */
export const getSavingsLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { startDate, endDate, type, goalId, limit = 100 } = req.query;

    // Build query filter
    const filter: FilterQuery<ISavingsLog> = { userId };

    if (startDate || endDate) {
      const dateQuery: { $gte?: Date; $lte?: Date } = {};
      if (startDate) {
        dateQuery.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateQuery.$lte = new Date(endDate as string);
      }
      filter.date = dateQuery;
    }

    if (type) {
      filter.type = type as 'money' | 'gold';
    }

    if (goalId) {
      filter.goalId = goalId as unknown as mongoose.Types.ObjectId;
    }

    const savingsLogs = await SavingsLog.find(filter)
      .populate('goalId', 'name price goldEquivalent')
      .sort({ date: -1 })
      .limit(Number(limit));

    res.status(200).json({ savingsLogs });
  } catch (error: unknown) {
    console.error('GetSavingsLogs error:', error);
    res.status(500).json({ error: 'Failed to fetch savings logs' });
  }
};

/**
 * Delete a savings log entry
 */
export const deleteSavingsLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const savingsLog = await SavingsLog.findOne({ _id: id, userId });

    if (!savingsLog) {
      res.status(404).json({ error: 'Savings log not found' });
      return;
    }

    await SavingsLog.deleteOne({ _id: id });

    res.status(200).json({ message: 'Savings log deleted successfully' });
  } catch (error: unknown) {
    console.error('DeleteSavingsLog error:', error);
    res.status(500).json({ error: 'Failed to delete savings log' });
  }
};

/**
 * Get analytics/aggregated data for savings logs
 */
export const getSavingsAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { period = 'month', startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: { $gte?: Date; $lte?: Date } = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    // Default to last 30 days if no dates provided
    if (!startDate && !endDate) {
      dateFilter.$gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Determine grouping format based on period
    const dateFormat =
      period === 'day'
        ? { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
        : period === 'week'
          ? { $dateToString: { format: '%Y-W%V', date: '$date' } }
          : { $dateToString: { format: '%Y-%m', date: '$date' } };

    // Aggregate savings by period
    const aggregation = await SavingsLog.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId as string),
          date: dateFilter,
        },
      },
      {
        $group: {
          _id: {
            period: dateFormat,
            type: '$type',
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.period': 1 },
      },
    ]);

    // Calculate total savings
    const totals = await SavingsLog.aggregate<{
      _id: string;
      totalAmount: number;
      count: number;
    }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId as string),
          date: dateFilter,
        },
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Format response
    const totalMoney = Number(totals.find((t) => t._id === 'money')?.totalAmount) || 0;
    const totalGold = Number(totals.find((t) => t._id === 'gold')?.totalAmount) || 0;
    const totalEntries = Number(totals.reduce((sum, t) => sum + t.count, 0));

    res.status(200).json({
      analytics: {
        period,
        startDate: dateFilter.$gte,
        endDate: dateFilter.$lte || new Date(),
        totals: {
          money: totalMoney,
          gold: totalGold,
          entries: totalEntries,
        },
        byPeriod: aggregation,
      },
    });
  } catch (error: unknown) {
    console.error('GetSavingsAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
