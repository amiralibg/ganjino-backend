import { Response } from 'express';
import { validationResult } from 'express-validator';
import Goal, { IGoal } from '../models/Goal';
import Profile from '../models/Profile';
import { AuthRequest } from '../middleware/auth';
import { get18KGoldPrice, calculateGoldEquivalent } from '../services/goldPrice.service';
import { calculateSavingsTimeline } from '../utils/savingsCalculator';

// Helper function to enrich goals with savings timeline and current values
const enrichGoalWithTimeline = async (
  goal: IGoal,
  userId: string
): Promise<Record<string, unknown>> => {
  try {
    const profile = await Profile.findOne({ userId });
    if (!profile || profile.monthlySalary <= 0) {
      return { ...goal.toObject(), timeline: null } as Record<string, unknown>;
    }

    // Fetch current gold price for accurate calculations
    const currentGoldPrice = await get18KGoldPrice();

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
    const remainingGold = Math.max(
      0,
      Number(goal.goldEquivalent) - Number(goal.savedGoldAmount)
    );
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

    // Enrich goals with timeline data
    const enrichedGoals = await Promise.all(
      goals.map((goal) => enrichGoalWithTimeline(goal, userId!))
    );

    res.status(200).json({ goals: enrichedGoals });
  } catch (error: unknown) {
    console.error('GetGoals error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
};

export const getGoalById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOne({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    res.status(200).json({ goal });
  } catch (error: unknown) {
    console.error('GetGoalById error:', error);
    res.status(500).json({ error: 'Failed to fetch goal' });
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
    });

    await goal.save();

    res.status(201).json({
      message: 'Goal created successfully',
      goal,
    });
  } catch (error: unknown) {
    console.error('CreateGoal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
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
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    const { name, price, isWishlisted, savedGoldAmount } = req.body as {
      name?: string;
      price?: number;
      isWishlisted?: boolean;
      savedGoldAmount?: number;
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

    await goal.save();

    res.status(200).json({
      message: 'Goal updated successfully',
      goal,
    });
  } catch (error: unknown) {
    console.error('UpdateGoal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
};

export const deleteGoal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOneAndDelete({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    res.status(200).json({ message: 'Goal deleted successfully' });
  } catch (error: unknown) {
    console.error('DeleteGoal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
};

export const toggleWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const goal = await Goal.findOne({ _id: id, userId });

    if (!goal) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }

    goal.isWishlisted = !goal.isWishlisted;
    await goal.save();

    res.status(200).json({
      message: 'Wishlist status updated',
      goal,
    });
  } catch (error: unknown) {
    console.error('ToggleWishlist error:', error);
    res.status(500).json({ error: 'Failed to toggle wishlist' });
  }
};

export const getWishlistedGoals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const goals = await Goal.find({ userId, isWishlisted: true }).sort({
      createdAt: -1,
    });

    // Enrich goals with timeline data
    const enrichedGoals = await Promise.all(
      goals.map((goal) => enrichGoalWithTimeline(goal, userId!))
    );

    res.status(200).json({ goals: enrichedGoals });
  } catch (error: unknown) {
    console.error('GetWishlistedGoals error:', error);
    res.status(500).json({ error: 'Failed to fetch wishlisted goals' });
  }
};
