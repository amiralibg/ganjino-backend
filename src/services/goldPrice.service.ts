import axios from 'axios';
import { env } from '../config/env';

const GOLD_API_URL = env.GOLD_API_URL;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

const getGoldApiKey = (): string => {
  const apiKey = env.GOLD_API_KEY;
  if (!apiKey) {
    throw new Error('GOLD_API_KEY environment variable is not set');
  }
  return apiKey;
};

interface GoldItem {
  date: string;
  time: string;
  time_unix: number;
  symbol: string;
  name_en: string;
  name: string;
  price: number;
  change_value: number;
  change_percent: number;
  unit: string;
}

interface GoldApiResponse {
  gold: GoldItem[];
  currency: unknown[];
  cryptocurrency: unknown[];
}

interface CachedGoldData {
  data: GoldItem[];
  timestamp: number;
}

let goldPriceCache: CachedGoldData | null = null;

export const fetchGoldPrices = async (): Promise<GoldItem[]> => {
  // Check if cache is valid
  if (goldPriceCache && Date.now() - goldPriceCache.timestamp < CACHE_DURATION) {
    console.log('Returning cached gold prices');
    return goldPriceCache.data;
  }

  try {
    console.log('Fetching fresh gold prices from API');
    const response = await axios.get<GoldApiResponse>(GOLD_API_URL, {
      params: { key: getGoldApiKey() },
      timeout: 10000, // 10 second timeout
    });

    const goldData = response.data.gold;

    // Update cache
    goldPriceCache = {
      data: goldData,
      timestamp: Date.now(),
    };

    return goldData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch gold prices:', errorMessage);

    // If we have cached data (even if expired), return it
    if (goldPriceCache) {
      console.log('Returning expired cache due to API error');
      return goldPriceCache.data;
    }

    throw new Error('Failed to fetch gold prices and no cache available');
  }
};

export const get18KGoldPrice = async (): Promise<number> => {
  const goldPrices = await fetchGoldPrices();
  const gold18K = goldPrices.find((item) => item.symbol === 'IR_GOLD_18K');

  if (!gold18K) {
    throw new Error('18K gold price not found');
  }

  return gold18K.price;
};

export const calculateGoldEquivalent = (priceInToman: number, goldPricePerGram: number): number => {
  // Returns how many grams of gold needed to buy the item
  return priceInToman / goldPricePerGram;
};
