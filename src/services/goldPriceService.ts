import GoldPriceHistory from '../models/GoldPriceHistory';
import { get18KGoldPrice } from './goldPrice.service';

/**
 * Fetch current gold price from BrsApi (via goldPrice.service)
 */
export const fetchCurrentGoldPrice = async (): Promise<number> => {
  try {
    const price = await get18KGoldPrice();
    return price;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching gold price from BrsApi:', errorMessage);
    throw new Error('Failed to fetch gold price');
  }
};

/**
 * Store today's gold price in history
 * Only stores if price doesn't already exist for today
 */
export const storeTodayGoldPrice = async (): Promise<void> => {
  try {
    // Get today's date at start of day (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check if we already have a price for today
    const existingPrice = await GoldPriceHistory.findOne({ date: today });

    if (existingPrice) {
      console.log(
        `Gold price for ${today.toISOString().split('T')[0]} already exists: ${
          existingPrice.price
        } Toman`
      );
      return;
    }

    // Fetch current price
    const currentPrice = await fetchCurrentGoldPrice();

    console.log(`Fetched current gold price: ${currentPrice} Toman`);

    if (!currentPrice || currentPrice <= 0) {
      throw new Error('Invalid gold price received');
    }

    // Store new price record
    const priceRecord = new GoldPriceHistory({
      price: currentPrice,
      date: today,
      source: 'brsapi.ir',
    });

    await priceRecord.save();
    console.log(
      `✅ Stored gold price for ${today.toISOString().split('T')[0]}: ${currentPrice} Toman`
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error storing gold price:', errorMessage);
    throw error;
  }
};

/**
 * Get gold price history for a date range
 */
export const getGoldPriceHistory = async (
  startDate: Date,
  endDate: Date,
  limit: number = 365
): Promise<Array<{ date: Date; price: number }>> => {
  try {
    const prices = await GoldPriceHistory.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ date: 1 }) // Ascending order (oldest first)
      .limit(limit)
      .select('date price -_id');

    return prices.map((p) => ({
      date: p.date,
      price: p.price,
    }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching gold price history:', errorMessage);
    throw error;
  }
};

/**
 * Seed historical data (for testing purposes)
 * Generates fake but realistic price data for the past N days
 */
export const seedHistoricalPrices = async (days: number = 30): Promise<void> => {
  try {
    console.log(`Seeding ${days} days of historical gold price data...`);

    let basePrice = 7000000; // Default base price
    try {
      const currentPrice = await fetchCurrentGoldPrice();
      if (currentPrice && currentPrice > 0) {
        basePrice = currentPrice;
      }
    } catch {
      console.log('Using default base price for seeding');
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Check if already exists
      const exists = await GoldPriceHistory.findOne({ date });
      if (exists) {
        continue;
      }

      // Generate realistic price variation (±2% per day)
      const variation = (Math.random() - 0.5) * 0.04; // -2% to +2%
      const dayPrice = Math.round(basePrice * (1 + variation * (i / days)));

      const priceRecord = new GoldPriceHistory({
        price: dayPrice,
        date,
        source: 'seeded',
      });

      await priceRecord.save();
    }

    console.log(`✅ Seeded ${days} days of historical prices`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error seeding historical prices:', errorMessage);
    throw error;
  }
};
