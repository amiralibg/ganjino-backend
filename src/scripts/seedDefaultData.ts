import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import Profile from '../models/Profile';
import Goal from '../models/Goal';
import SavingsLog from '../models/SavingsLog';
import GoldPriceHistory from '../models/GoldPriceHistory';
import { UserRole } from '../constants/roles';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI?.trim() || 'mongodb://localhost:27017/ganjino';
const BASE_GOLD_PRICE = 3_500_000;
const DAYS_OF_GOLD_HISTORY = 30;

const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_ADMIN_EMAIL?.trim() || 'superadmin@ganjino.local';
const SUPER_ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD?.trim() || 'SuperAdmin123!';
const SUPER_ADMIN_NAME = process.env.SEED_SUPER_ADMIN_NAME?.trim() || 'Ganjino Super Admin';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL?.trim() || 'admin@ganjino.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD?.trim() || 'Admin123!';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME?.trim() || 'Ganjino Admin';

const SAMPLE_USERS = [
  {
    email: 'sara@example.com',
    password: 'Password123!',
    name: 'Sara Moradi',
    monthlySalary: 2_500,
    monthlySavingsPercentage: 25,
  },
  {
    email: 'amir@example.com',
    password: 'Password123!',
    name: 'Amir Rahimi',
    monthlySalary: 3_200,
    monthlySavingsPercentage: 20,
  },
  {
    email: 'niloofar@example.com',
    password: 'Password123!',
    name: 'Niloofar Ahmadi',
    monthlySalary: 2_900,
    monthlySavingsPercentage: 30,
  },
];

const startOfUtcDay = (value: Date): Date => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
};

const ensurePrivilegedUser = async (params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<IUser> => {
  let user = await User.findOne({ email: params.email });
  if (!user) {
    user = new User({
      email: params.email,
      password: params.password,
      name: params.name,
      role: params.role,
      isActive: true,
    });
    await user.save();
    console.log(`Created ${params.role}: ${params.email}`);
  } else {
    user.name = params.name;
    user.role = params.role;
    user.isActive = true;
    await user.save();
    console.log(`Updated ${params.role}: ${params.email}`);
  }

  await Profile.updateOne(
    { userId: user._id },
    {
      $setOnInsert: {
        userId: user._id,
        currency: 'USD',
        monthlySalary: 0,
        monthlySavingsPercentage: 20,
      },
    },
    { upsert: true }
  );

  return user;
};

const ensureSampleUserData = async (): Promise<void> => {
  for (const [index, sample] of SAMPLE_USERS.entries()) {
    let user = await User.findOne({ email: sample.email });
    if (!user) {
      user = new User({
        email: sample.email,
        password: sample.password,
        name: sample.name,
        role: 'user',
        isActive: true,
      });
      await user.save();
      console.log(`Created sample user: ${sample.email}`);
    }

    await Profile.updateOne(
      { userId: user._id },
      {
        $set: {
          monthlySalary: sample.monthlySalary,
          monthlySavingsPercentage: sample.monthlySavingsPercentage,
          currency: 'USD',
        },
      },
      { upsert: true }
    );

    const goalName = index % 2 === 0 ? 'Emergency Fund' : 'Laptop Upgrade';
    const goalPrice = index % 2 === 0 ? 2_400 : 1_800;
    const goalGoldEquivalent = Number((goalPrice / 70).toFixed(4));

    await Goal.updateOne(
      { userId: user._id, name: goalName },
      {
        $setOnInsert: {
          userId: user._id,
          name: goalName,
          price: goalPrice,
          goldEquivalent: goalGoldEquivalent,
          goldPriceAtCreation: BASE_GOLD_PRICE,
          isWishlisted: false,
          savedGoldAmount: Number((goalGoldEquivalent * 0.2).toFixed(4)),
        },
      },
      { upsert: true }
    );

    const currentMonth = new Date();
    const monthStart = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1));
    for (let i = 0; i < 3; i += 1) {
      const logDate = new Date(monthStart);
      logDate.setUTCDate(monthStart.getUTCDate() + i * 5);

      await SavingsLog.updateOne(
        {
          userId: user._id,
          date: startOfUtcDay(logDate),
          type: 'money',
          note: 'Seeded monthly saving',
        },
        {
          $setOnInsert: {
            userId: user._id,
            amount: 100 + i * 25,
            type: 'money',
            goalAllocations: [],
            note: 'Seeded monthly saving',
            date: startOfUtcDay(logDate),
          },
        },
        { upsert: true }
      );
    }
  }
};

const ensureGoldHistory = async (): Promise<void> => {
  const today = startOfUtcDay(new Date());
  for (let dayOffset = 0; dayOffset < DAYS_OF_GOLD_HISTORY; dayOffset += 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - dayOffset);

    const wave = Math.sin(dayOffset / 4) * 55_000;
    const trend = dayOffset * 2_000;
    const price = Math.max(1, Math.round(BASE_GOLD_PRICE - trend + wave));

    await GoldPriceHistory.updateOne(
      { date },
      {
        $setOnInsert: {
          date,
          price,
          source: 'seed-script',
        },
      },
      { upsert: true }
    );
  }
};

const run = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to ${MONGODB_URI}`);

    await ensurePrivilegedUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      name: SUPER_ADMIN_NAME,
      role: 'super_admin',
    });
    await ensurePrivilegedUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      name: ADMIN_NAME,
      role: 'admin',
    });

    await ensureSampleUserData();
    await ensureGoldHistory();

    console.log('Default data seed complete.');
  } catch (error) {
    console.error('Default data seed failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

void run();
