import express, { Router } from 'express';
import { body, query } from 'express-validator';
import {
  createSavingsLog,
  getSavingsLogs,
  deleteSavingsLog,
  getSavingsAnalytics,
} from '../controllers/savingsLog.controller';
import { authenticateToken } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';
import { validateRequest } from '../middleware/validateRequest';

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: SavingsLogs
 *   description: Savings history and analytics management
 */

/**
 * @swagger
 * /api/logs:
 *   post:
 *     summary: Create a new savings log entry
 *     tags: [SavingsLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount saved (in currency or gold grams)
 *               type:
 *                 type: string
 *                 enum: [money, gold]
 *                 default: money
 *                 description: Type of savings entry
 *               goalId:
 *                 type: string
 *                 description: Optional goal this savings is for
 *               note:
 *                 type: string
 *                 description: Optional note about this savings
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Date of savings (defaults to now)
 *     responses:
 *       201:
 *         description: Savings log created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticateToken,
  [
    body('amount').isFloat({ min: 0 }).withMessage(MESSAGES.validation.amountPositive),
    body('type')
      .optional()
      .isIn(['money', 'gold'])
      .withMessage(MESSAGES.validation.savingsTypeValid),
    body('goalId').optional().isMongoId().withMessage(MESSAGES.validation.goalIdValid),
    body('goalAllocations')
      .optional()
      .isArray()
      .withMessage(MESSAGES.validation.goalAllocationsArray),
    body('goalAllocations.*.goalId')
      .optional()
      .isMongoId()
      .withMessage(MESSAGES.validation.goalAllocationGoalIdValid),
    body('goalAllocations.*.amount')
      .optional()
      .isFloat({ min: 0.000001 })
      .withMessage(MESSAGES.validation.goalAllocationAmountPositive),
    body('note')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage(MESSAGES.validation.noteMax500),
    body('date').optional().isISO8601().withMessage(MESSAGES.validation.dateFormatInvalid),
  ],
  createSavingsLog
);

/**
 * @swagger
 * /api/logs:
 *   get:
 *     summary: Get all savings logs for the authenticated user
 *     tags: [SavingsLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs until this date
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [money, gold]
 *         description: Filter by type
 *       - in: query
 *         name: goalId
 *         schema:
 *           type: string
 *         description: Filter by goal
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 100
 *         description: Maximum number of logs to return
 *     responses:
 *       200:
 *         description: List of savings logs
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticateToken,
  [
    query('startDate').optional().isISO8601().withMessage(MESSAGES.validation.dateFormatInvalid),
    query('endDate').optional().isISO8601().withMessage(MESSAGES.validation.dateFormatInvalid),
    query('type')
      .optional()
      .isIn(['money', 'gold'])
      .withMessage(MESSAGES.validation.savingsTypeValid),
    query('goalId').optional().isMongoId().withMessage(MESSAGES.validation.goalIdValid),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage(MESSAGES.savings.invalidLogsLimit),
  ],
  validateRequest,
  getSavingsLogs
);

/**
 * @swagger
 * /api/logs/analytics:
 *   get:
 *     summary: Get aggregated savings analytics
 *     tags: [SavingsLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: month
 *         description: Aggregation period
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics (defaults to 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics (defaults to now)
 *     responses:
 *       200:
 *         description: Analytics data
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/analytics',
  authenticateToken,
  [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month'])
      .withMessage(MESSAGES.savings.invalidPeriod),
    query('startDate').optional().isISO8601().withMessage(MESSAGES.validation.dateFormatInvalid),
    query('endDate').optional().isISO8601().withMessage(MESSAGES.validation.dateFormatInvalid),
  ],
  validateRequest,
  getSavingsAnalytics
);

/**
 * @swagger
 * /api/logs/{id}:
 *   delete:
 *     summary: Delete a savings log entry
 *     tags: [SavingsLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Savings log ID
 *     responses:
 *       200:
 *         description: Savings log deleted successfully
 *       404:
 *         description: Savings log not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authenticateToken, deleteSavingsLog);

export default router;
