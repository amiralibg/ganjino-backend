import { Request, Response } from 'express';
import { fetchGoldPrices, get18KGoldPrice } from '../services/goldPrice.service';
import { MESSAGES } from '../constants/messages';

export const getGoldPrices = async (_req: Request, res: Response): Promise<void> => {
  try {
    const goldPrices = await fetchGoldPrices();
    res.status(200).json({ gold: goldPrices });
  } catch (error: unknown) {
    console.error('GetGoldPrices error:', error);
    res.status(500).json({ error: MESSAGES.gold.failedFetchGoldPrices });
  }
};

export const get18KPrice = async (_req: Request, res: Response): Promise<void> => {
  try {
    const price = await get18KGoldPrice();
    res.status(200).json({ price, unit: 'تومان' });
  } catch (error: unknown) {
    console.error('Get18KPrice error:', error);
    res.status(500).json({ error: MESSAGES.gold.failedFetch18kPrice });
  }
};
