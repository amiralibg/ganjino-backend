import mongoose, { Document, Schema } from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     SavingsLog:
 *       type: object
 *       required:
 *         - userId
 *         - amount
 *         - type
 *       properties:
 *         id:
 *           type: string
 *           description: The auto-generated id of the savings log
 *         userId:
 *           type: string
 *           description: The id of the user
 *         amount:
 *           type: number
 *           description: Amount saved in currency or gold grams
 *         type:
 *           type: string
 *           enum: [money, gold]
 *           description: Type of savings entry
 *         goalId:
 *           type: string
 *           description: Optional reference to associated goal
 *         note:
 *           type: string
 *           description: Optional note about this savings entry
 *         date:
 *           type: string
 *           format: date-time
 *           description: Date of the savings entry
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Log creation timestamp
 */
export interface ISavingsLog extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number; // In currency (Toman) or gold (grams) depending on type
  type: 'money' | 'gold';
  goalId?: mongoose.Types.ObjectId; // Optional: which goal this savings is for
  note?: string;
  date: Date; // When the savings occurred
  createdAt: Date;
  updatedAt: Date;
}

const SavingsLogSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ['money', 'gold'],
      required: true,
      default: 'money',
    },
    goalId: {
      type: Schema.Types.ObjectId,
      ref: 'Goal',
      required: false,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries by user and date
SavingsLogSchema.index({ userId: 1, date: -1 });

export default mongoose.model<ISavingsLog>('SavingsLog', SavingsLogSchema);
