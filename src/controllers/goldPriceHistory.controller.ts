import { Request, Response } from 'express';
import {
  getGoldPriceHistory,
  seedHistoricalPrices,
  storeTodayGoldPrice,
} from '../services/goldPriceService';
import { MESSAGES } from '../constants/messages';

/**
 * Get historical gold prices
 */
export const getGoldPriceHistoryController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, days, limit } = req.query;

    let start: Date;
    let end: Date = new Date();
    end.setUTCHours(23, 59, 59, 999); // End of today

    if (startDate && endDate) {
      // Use provided date range
      start = new Date(startDate as string);
      end = new Date(endDate as string);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        res.status(400).json({ error: MESSAGES.goldHistory.invalidDateRange });
        return;
      }
    } else if (days) {
      // Use days parameter (e.g., last 30 days)
      const numDays = parseInt(days as string, 10);
      if (!Number.isFinite(numDays) || numDays <= 0 || numDays > 3650) {
        res.status(400).json({ error: MESSAGES.goldHistory.invalidDaysRange });
        return;
      }
      start = new Date();
      start.setDate(start.getDate() - numDays);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      // Default to last 30 days
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setUTCHours(0, 0, 0, 0);
    }

    const parsedLimit = limit ? parseInt(limit as string, 10) : 365;
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0 || parsedLimit > 5000) {
      res.status(400).json({ error: MESSAGES.goldHistory.invalidLimit });
      return;
    }

    const history = await getGoldPriceHistory(start, end, parsedLimit);

    res.status(200).json({
      history,
      count: history.length,
      startDate: start,
      endDate: end,
    });
  } catch (error: unknown) {
    console.error('GetGoldPriceHistory error:', error);
    res.status(500).json({ error: MESSAGES.goldHistory.fetchedFailed });
  }
};

/**
 * Manually trigger storing today's gold price
 * (Admin/testing endpoint)
 */
export const storeTodayPriceController = async (_req: Request, res: Response): Promise<void> => {
  try {
    await storeTodayGoldPrice();
    res.status(200).json({ message: MESSAGES.goldHistory.storeTodaySuccess });
  } catch (error: unknown) {
    console.error('StoreTodayPrice error:', error);
    res.status(500).json({ error: MESSAGES.goldHistory.storeTodayFailed });
  }
};

/**
 * Seed historical data (Admin/testing endpoint)
 */
export const seedHistoricalPricesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { days } = req.query;
    const numDays = days ? parseInt(days as string, 10) : 30;
    if (!Number.isFinite(numDays) || numDays <= 0 || numDays > 3650) {
      res.status(400).json({ error: MESSAGES.goldHistory.invalidDaysRange });
      return;
    }

    await seedHistoricalPrices(numDays);

    res.status(200).json({
      message: `${MESSAGES.goldHistory.seedSuccess} (${numDays} روز)`,
    });
  } catch (error: unknown) {
    console.error('SeedHistoricalPrices error:', error);
    res.status(500).json({ error: MESSAGES.goldHistory.seedFailed });
  }
};
