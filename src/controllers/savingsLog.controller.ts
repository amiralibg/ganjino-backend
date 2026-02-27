import { Response } from 'express';
import { validationResult } from 'express-validator';
import mongoose, { FilterQuery } from 'mongoose';
import SavingsLog, { ISavingsLog } from '../models/SavingsLog';
import Goal from '../models/Goal';
import { AuthRequest } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';
import { get18KGoldPrice } from '../services/goldPrice.service';

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
      goalAllocations?: Array<{ goalId: string; amount: number }>;
      note?: string;
      date?: string;
    };
    const { goalAllocations } = req.body as {
      goalAllocations?: Array<{ goalId: string; amount: number }>;
    };

    if (goalId && goalAllocations && goalAllocations.length > 0) {
      res.status(400).json({ error: MESSAGES.savings.goalIdAndAllocationsConflict });
      return;
    }

    // Validate goalId if provided
    if (goalId) {
      const goal = await Goal.findOne({ _id: goalId, userId });
      if (!goal) {
        res.status(404).json({ error: MESSAGES.savings.goalNotFound });
        return;
      }
    }

    const requestedAllocations =
      goalAllocations && goalAllocations.length > 0
        ? goalAllocations
        : goalId
          ? [{ goalId, amount: Number(amount) }]
          : [];

    const allocationMap = new Map<string, number>();
    for (const allocation of requestedAllocations) {
      const allocationGoalId = String(allocation.goalId || '');
      const allocationAmount = Number(allocation.amount);

      if (!mongoose.isValidObjectId(allocationGoalId)) {
        res.status(400).json({ error: MESSAGES.savings.invalidGoalId });
        return;
      }

      if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) {
        res.status(400).json({ error: MESSAGES.savings.invalidAllocationAmount });
        return;
      }

      allocationMap.set(
        allocationGoalId,
        (allocationMap.get(allocationGoalId) || 0) + allocationAmount
      );
    }

    const mergedAllocations = Array.from(allocationMap.entries()).map(
      ([goalIdValue, amountValue]) => ({
        goalId: goalIdValue,
        amount: amountValue,
      })
    );

    const totalAllocated = mergedAllocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0
    );
    if (totalAllocated > Number(amount)) {
      res.status(400).json({ error: MESSAGES.savings.allocatedAmountExceedsLog });
      return;
    }

    let currentGoldPrice: number | null = null;
    if ((type || 'money') === 'money' && mergedAllocations.length > 0) {
      currentGoldPrice = await get18KGoldPrice();
    }

    const allocationGoalIds = mergedAllocations.map((allocation) => allocation.goalId);
    if (allocationGoalIds.length > 0) {
      const goals = await Goal.find({
        _id: { $in: allocationGoalIds },
        userId,
      }).select('_id');

      if (goals.length !== allocationGoalIds.length) {
        res.status(404).json({ error: MESSAGES.savings.goalNotFound });
        return;
      }
    }

    const normalizedAllocations = mergedAllocations.map((allocation) => {
      const allocatedGoldAmount =
        (type || 'money') === 'gold'
          ? allocation.amount
          : currentGoldPrice && currentGoldPrice > 0
            ? allocation.amount / currentGoldPrice
            : 0;

      return {
        goalId: new mongoose.Types.ObjectId(allocation.goalId),
        amount: allocation.amount,
        allocatedGoldAmount,
      };
    });

    const savingsLog = new SavingsLog({
      userId,
      amount: Number(amount),
      type: type || 'money',
      goalId: goalId || undefined,
      goalAllocations: normalizedAllocations,
      note: note || undefined,
      date: date ? new Date(String(date)) : new Date(),
    });

    await savingsLog.save();

    if (normalizedAllocations.length > 0) {
      await Promise.all(
        normalizedAllocations.map((allocation) =>
          Goal.updateOne(
            { _id: allocation.goalId, userId },
            { $inc: { savedGoldAmount: allocation.allocatedGoldAmount } }
          )
        )
      );
    }

    res.status(201).json({
      message: MESSAGES.savings.createdSuccess,
      savingsLog,
    });
  } catch (error: unknown) {
    console.error('CreateSavingsLog error:', error);
    res.status(500).json({ error: MESSAGES.savings.failedCreate });
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
        const parsedStartDate = new Date(startDate as string);
        if (Number.isNaN(parsedStartDate.getTime())) {
          res.status(400).json({ error: MESSAGES.common.invalidStartDate });
          return;
        }
        dateQuery.$gte = parsedStartDate;
      }
      if (endDate) {
        const parsedEndDate = new Date(endDate as string);
        if (Number.isNaN(parsedEndDate.getTime())) {
          res.status(400).json({ error: MESSAGES.common.invalidEndDate });
          return;
        }
        dateQuery.$lte = parsedEndDate;
      }
      if (dateQuery.$gte && dateQuery.$lte && dateQuery.$gte > dateQuery.$lte) {
        res.status(400).json({ error: MESSAGES.common.startDateMustBeBeforeEndDate });
        return;
      }
      filter.date = dateQuery;
    }

    if (type) {
      if (type !== 'money' && type !== 'gold') {
        res.status(400).json({ error: MESSAGES.savings.invalidType });
        return;
      }
      filter.type = type;
    }

    if (goalId) {
      if (!mongoose.isValidObjectId(goalId)) {
        res.status(400).json({ error: MESSAGES.savings.invalidGoalId });
        return;
      }

      if (typeof goalId !== 'string') {
        res.status(400).json({ error: MESSAGES.savings.invalidGoalId });
        return;
      }

      filter.goalId = new mongoose.Types.ObjectId(goalId);
    }

    const parsedLimit = Number(limit);
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || parsedLimit > 500) {
      res.status(400).json({ error: MESSAGES.savings.invalidLogsLimit });
      return;
    }

    const savingsLogs = await SavingsLog.find(filter)
      .populate('goalId', 'name price goldEquivalent')
      .sort({ date: -1 })
      .limit(parsedLimit);

    res.status(200).json({ savingsLogs });
  } catch (error: unknown) {
    console.error('GetSavingsLogs error:', error);
    res.status(500).json({ error: MESSAGES.savings.failedFetchLogs });
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
      res.status(404).json({ error: MESSAGES.savings.notFound });
      return;
    }

    await SavingsLog.deleteOne({ _id: id });

    res.status(200).json({ message: MESSAGES.savings.deletedSuccess });
  } catch (error: unknown) {
    console.error('DeleteSavingsLog error:', error);
    res.status(500).json({ error: MESSAGES.savings.failedDelete });
  }
};

/**
 * Get analytics/aggregated data for savings logs
 */
export const getSavingsAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { period = 'month', startDate, endDate } = req.query;
    if (period !== 'day' && period !== 'week' && period !== 'month') {
      res.status(400).json({ error: MESSAGES.savings.invalidPeriod });
      return;
    }

    // Build date filter
    const dateFilter: { $gte?: Date; $lte?: Date } = {};
    if (startDate) {
      const parsedStartDate = new Date(startDate as string);
      if (Number.isNaN(parsedStartDate.getTime())) {
        res.status(400).json({ error: MESSAGES.common.invalidStartDate });
        return;
      }
      dateFilter.$gte = parsedStartDate;
    }
    if (endDate) {
      const parsedEndDate = new Date(endDate as string);
      if (Number.isNaN(parsedEndDate.getTime())) {
        res.status(400).json({ error: MESSAGES.common.invalidEndDate });
        return;
      }
      dateFilter.$lte = parsedEndDate;
    }
    if (dateFilter.$gte && dateFilter.$lte && dateFilter.$gte > dateFilter.$lte) {
      res.status(400).json({ error: MESSAGES.common.startDateMustBeBeforeEndDate });
      return;
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
    res.status(500).json({ error: MESSAGES.savings.failedFetchAnalytics });
  }
};
