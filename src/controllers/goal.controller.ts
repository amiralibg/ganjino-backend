import { Response } from 'express';
import { validationResult } from 'express-validator';
import Goal, { IGoal } from '../models/Goal';
import Profile from '../models/Profile';
import { AuthRequest } from '../middleware/auth';
import { get18KGoldPrice, calculateGoldEquivalent } from '../services/goldPrice.service';
import { calculateSavingsTimeline } from '../utils/savingsCalculator';
import { IProfile } from '../models/Profile';
import { MESSAGES } from '../constants/messages';

type GoalEnrichmentContext = {
  profile: IProfile | null;
  currentGoldPrice: number | null;
};

// Helper function to enrich goals with savings timeline and current values
const enrichGoalWithTimeline = (
  goal: IGoal,
  context: GoalEnrichmentContext
): Record<string, unknown> => {
  try {
    const { profile, currentGoldPrice } = context;
    if (!profile || profile.monthlySalary <= 0) {
      return { ...goal.toObject(), timeline: null } as Record<string, unknown>;
    }

    if (!currentGoldPrice || currentGoldPrice <= 0) {
      return { ...goal.toObject(), timeline: null } as Record<string, unknown>;
    }

    const timeline = calculateSavingsTimeline(
      Number(goal.price),
      Number(goal.goldEquivalent),
      profile.monthlySalary,
      profile.monthlySavingsPercentage,
      Number(goal.savedGoldAmount),
      currentGoldPrice // Pass current gold price
    );

    // Calculate current values based on today's gold price
    const currentPriceInToman = Number(goal.goldEquivalent) * currentGoldPrice;
    const savedAmountInToman = Number(goal.savedGoldAmount) * currentGoldPrice;
    const remainingGold = Math.max(0, Number(goal.goldEquivalent) - Number(goal.savedGoldAmount));
    const remainingInToman = remainingGold * currentGoldPrice;

    return {
      ...goal.toObject(),
      timeline,
      currentGoldPrice, // Current market price per gram
      currentPriceInToman, // Current total price based on today's gold price
      savedAmountInToman, // Current value of saved gold in Toman
      remainingInToman, // Remaining amount in Toman at current prices
    } as Record<string, unknown>;
  } catch {
    return { ...goal.toObject(), timeline: null } as Record<string, unknown>;
  }
};

export const getGoals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const goals = await Goal.find({ userId }).sort({ createdAt: -1 });
    const profile = await Profile.findOne({ userId });
    const currentGoldPrice = profile && profile.monthlySalary > 0 ? await get18KGoldPrice() : null;

    // Enrich goals with timeline data
    const enrichedGoals = goals.map((goal) =>
      enrichGoalWithTimeline(goal, { profile, currentGoldPrice })
    );

    res.status(200).json({ goals: enrichedGoals });
  } catch (error: unknown) {
    console.error('GetGoals error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedFetchGoals });
  }
};

export const getGoalById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOne({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: MESSAGES.goals.notFound });
      return;
    }

    res.status(200).json({ goal });
  } catch (error: unknown) {
    console.error('GetGoalById error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedFetchGoal });
  }
};

export const createGoal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.userId;
    const { name, price, isWishlisted, savedGoldAmount } = req.body as {
      name: string;
      price: number;
      isWishlisted?: boolean;
      savedGoldAmount?: number;
      recurringPlan?: {
        enabled?: boolean;
        frequency?: 'weekly' | 'monthly';
        dayOfWeek?: number;
        dayOfMonth?: number;
        reminderHour?: number;
      };
    };
    const { recurringPlan } = req.body as {
      recurringPlan?: {
        enabled?: boolean;
        frequency?: 'weekly' | 'monthly';
        dayOfWeek?: number;
        dayOfMonth?: number;
        reminderHour?: number;
      };
    };

    // Fetch current 18K gold price
    const goldPrice = await get18KGoldPrice();
    const goldEquivalent = calculateGoldEquivalent(Number(price), goldPrice);

    const goal = new Goal({
      userId,
      name,
      price: Number(price),
      goldEquivalent,
      goldPriceAtCreation: goldPrice,
      isWishlisted: isWishlisted || false,
      savedGoldAmount: Number(savedGoldAmount || 0),
      recurringPlan: {
        enabled: recurringPlan?.enabled || false,
        frequency: recurringPlan?.frequency || 'monthly',
        dayOfWeek:
          recurringPlan?.frequency === 'weekly' ? Number(recurringPlan?.dayOfWeek || 0) : undefined,
        dayOfMonth:
          recurringPlan?.frequency === 'monthly'
            ? Number(recurringPlan?.dayOfMonth || 1)
            : undefined,
        reminderHour: Number(recurringPlan?.reminderHour ?? 20),
      },
    });

    await goal.save();

    res.status(201).json({
      message: MESSAGES.goals.createdSuccess,
      goal,
    });
  } catch (error: unknown) {
    console.error('CreateGoal error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedCreateGoal });
  }
};

export const updateGoal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOne({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: MESSAGES.goals.notFound });
      return;
    }

    const { name, price, isWishlisted, savedGoldAmount } = req.body as {
      name?: string;
      price?: number;
      isWishlisted?: boolean;
      savedGoldAmount?: number;
      recurringPlan?: {
        enabled?: boolean;
        frequency?: 'weekly' | 'monthly';
        dayOfWeek?: number;
        dayOfMonth?: number;
        reminderHour?: number;
      };
    };
    const { recurringPlan } = req.body as {
      recurringPlan?: {
        enabled?: boolean;
        frequency?: 'weekly' | 'monthly';
        dayOfWeek?: number;
        dayOfMonth?: number;
        reminderHour?: number;
      };
    };

    if (name !== undefined) {
      goal.name = name;
    }

    // If price is updated, recalculate gold equivalent
    if (price !== undefined) {
      goal.price = Number(price);
      const goldPrice = await get18KGoldPrice();
      goal.goldEquivalent = calculateGoldEquivalent(Number(price), goldPrice);
      goal.goldPriceAtCreation = goldPrice;
    }

    if (isWishlisted !== undefined) {
      goal.isWishlisted = isWishlisted;
    }
    if (savedGoldAmount !== undefined) {
      goal.savedGoldAmount = Number(savedGoldAmount);
    }
    if (recurringPlan !== undefined) {
      goal.recurringPlan = {
        enabled: recurringPlan.enabled ?? goal.recurringPlan?.enabled ?? false,
        frequency: recurringPlan.frequency ?? goal.recurringPlan?.frequency ?? 'monthly',
        dayOfWeek:
          recurringPlan.frequency === 'weekly'
            ? Number(recurringPlan.dayOfWeek ?? goal.recurringPlan?.dayOfWeek ?? 0)
            : recurringPlan.dayOfWeek ?? goal.recurringPlan?.dayOfWeek,
        dayOfMonth:
          recurringPlan.frequency === 'monthly'
            ? Number(recurringPlan.dayOfMonth ?? goal.recurringPlan?.dayOfMonth ?? 1)
            : recurringPlan.dayOfMonth ?? goal.recurringPlan?.dayOfMonth,
        reminderHour: Number(recurringPlan.reminderHour ?? goal.recurringPlan?.reminderHour ?? 20),
      };
    }

    await goal.save();

    res.status(200).json({
      message: MESSAGES.goals.updatedSuccess,
      goal,
    });
  } catch (error: unknown) {
    console.error('UpdateGoal error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedUpdateGoal });
  }
};

export const deleteGoal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOneAndDelete({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: MESSAGES.goals.notFound });
      return;
    }

    res.status(200).json({ message: MESSAGES.goals.deletedSuccess });
  } catch (error: unknown) {
    console.error('DeleteGoal error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedDeleteGoal });
  }
};

export const toggleWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOne({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: MESSAGES.goals.notFound });
      return;
    }

    goal.isWishlisted = !goal.isWishlisted;
    await goal.save();

    res.status(200).json({
      message: MESSAGES.goals.wishlistUpdated,
      goal,
    });
  } catch (error: unknown) {
    console.error('ToggleWishlist error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedToggleWishlist });
  }
};

export const getWishlistedGoals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const goals = await Goal.find({ userId, isWishlisted: true }).sort({
      createdAt: -1,
    });
    const profile = await Profile.findOne({ userId });
    const currentGoldPrice = profile && profile.monthlySalary > 0 ? await get18KGoldPrice() : null;

    // Enrich goals with timeline data
    const enrichedGoals = goals.map((goal) =>
      enrichGoalWithTimeline(goal, { profile, currentGoldPrice })
    );

    res.status(200).json({ goals: enrichedGoals });
  } catch (error: unknown) {
    console.error('GetWishlistedGoals error:', error);
    res.status(500).json({ error: MESSAGES.goals.failedFetchWishlistedGoals });
  }
};
