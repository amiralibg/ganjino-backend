import dotenv from 'dotenv';

dotenv.config();

type NodeEnv = 'development' | 'test' | 'production';

export interface AppEnv {
  NODE_ENV: NodeEnv;
  PORT: number;
  JWT_SECRET: string;
  MONGODB_URI: string;
  GOLD_API_KEY: string;
  GOLD_API_URL: string;
  CORS_ORIGIN: string[];
}

const DEFAULT_GOLD_API_URL = 'https://BrsApi.ir/Api/Market/Gold_Currency.php';
const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/ganjino';
const DEFAULT_PORT = 3000;

const parseNodeEnv = (value: string | undefined): NodeEnv => {
  if (value === 'production' || value === 'test' || value === 'development') {
    return value;
  }
  return 'development';
};

const parsePort = (value: string | undefined): number => {
  const port = Number(value);
  if (Number.isFinite(port) && port > 0 && port <= 65535) {
    return port;
  }
  return DEFAULT_PORT;
};

const requireValue = (value: string | undefined, key: string): string => {
  if (!value || !value.trim()) {
    throw new Error(`${key} environment variable is required`);
  }
  return value.trim();
};

const parseCorsOrigins = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const validateEnv = (): AppEnv => {
  const NODE_ENV = parseNodeEnv(process.env.NODE_ENV);
  const PORT = parsePort(process.env.PORT);

  const JWT_SECRET = requireValue(process.env.JWT_SECRET, 'JWT_SECRET');

  const MONGODB_URI = process.env.MONGODB_URI?.trim() || DEFAULT_MONGODB_URI;
  const GOLD_API_URL = process.env.GOLD_API_URL?.trim() || DEFAULT_GOLD_API_URL;
  const GOLD_API_KEY = requireValue(process.env.GOLD_API_KEY, 'GOLD_API_KEY');
  const CORS_ORIGIN = parseCorsOrigins(process.env.CORS_ORIGIN);

  if (NODE_ENV === 'production' && CORS_ORIGIN.length === 0) {
    throw new Error('CORS_ORIGIN must be set in production');
  }

  return {
    NODE_ENV,
    PORT,
    JWT_SECRET,
    MONGODB_URI,
    GOLD_API_KEY,
    GOLD_API_URL,
    CORS_ORIGIN,
  };
};

export const env = validateEnv();
