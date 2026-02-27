import mongoose, { Document, Schema } from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     Goal:
 *       type: object
 *       required:
 *         - userId
 *         - name
 *         - price
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the goal
 *         userId:
 *           type: string
 *           description: The id of the user who owns this goal
 *         name:
 *           type: string
 *           description: Goal name
 *         price:
 *           type: number
 *           description: Goal price in Toman
 *         goldEquivalent:
 *           type: number
 *           description: How many grams of 18K gold needed to buy this goal
 *         goldPriceAtCreation:
 *           type: number
 *           description: Price of 18K gold per gram when goal was added
 *         isWishlisted:
 *           type: boolean
 *           description: Whether the goal is in wishlist
 *         savedGoldAmount:
 *           type: number
 *           description: Amount of gold (in grams) saved so far
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Goal creation timestamp
 */
export interface IGoal extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  goldEquivalent: number;
  goldPriceAtCreation: number;
  isWishlisted: boolean;
  savedGoldAmount: number;
  recurringPlan: {
    enabled: boolean;
    frequency: 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
    reminderHour: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const GoalSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    goldEquivalent: {
      type: Number,
      required: true,
      min: 0,
    },
    goldPriceAtCreation: {
      type: Number,
      required: true,
      min: 0,
    },
    isWishlisted: {
      type: Boolean,
      default: false,
    },
    savedGoldAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    recurringPlan: {
      enabled: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ['weekly', 'monthly'],
        default: 'monthly',
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 28,
      },
      reminderHour: {
        type: Number,
        min: 0,
        max: 23,
        default: 20,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IGoal>('Goal', GoalSchema);
