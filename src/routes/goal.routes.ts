import { Router } from 'express';
import { body } from 'express-validator';
import {
  getGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  toggleWishlist,
  getWishlistedGoals,
} from '../controllers/goal.controller';
import { authenticateToken } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';

const router: Router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/goals:
 *   get:
 *     summary: Get all goals for the authenticated user
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of goals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goals:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Goal'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getGoals);

/**
 * @swagger
 * /api/goals/wishlisted:
 *   get:
 *     summary: Get all wishlisted goals for the authenticated user
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of wishlisted goals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goals:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Goal'
 *       401:
 *         description: Unauthorized
 */
router.get('/wishlisted', getWishlistedGoals);

/**
 * @swagger
 * /api/goals/{id}:
 *   get:
 *     summary: Get a goal by ID
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Goal ID
 *     responses:
 *       200:
 *         description: Goal details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 goal:
 *                   $ref: '#/components/schemas/Goal'
 *       404:
 *         description: Goal not found
 */
router.get('/:id', getGoalById);

/**
 * @swagger
 * /api/goals:
 *   post:
 *     summary: Create a new goal
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - monthlySavings
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               monthlySavings:
 *                 type: number
 *                 minimum: 0
 *               isWishlisted:
 *                 type: boolean
 *               savedAmount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Goal created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 goal:
 *                   $ref: '#/components/schemas/Goal'
 *       400:
 *         description: Validation error
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage(MESSAGES.validation.goalNameRequired),
    body('price').isFloat({ min: 0 }).withMessage(MESSAGES.validation.positivePriceRequired),
    body('savedGoldAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage(MESSAGES.validation.positiveSavedGoldAmountRequired),
    body('recurringPlan.enabled').optional().isBoolean(),
    body('recurringPlan.frequency')
      .optional()
      .isIn(['weekly', 'monthly'])
      .withMessage(MESSAGES.validation.recurringFrequencyValid),
    body('recurringPlan.dayOfWeek')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage(MESSAGES.validation.recurringDayOfWeekValid),
    body('recurringPlan.dayOfMonth')
      .optional()
      .isInt({ min: 1, max: 28 })
      .withMessage(MESSAGES.validation.recurringDayOfMonthValid),
    body('recurringPlan.reminderHour')
      .optional()
      .isInt({ min: 0, max: 23 })
      .withMessage(MESSAGES.validation.recurringReminderHourValid),
  ],
  createGoal
);

/**
 * @swagger
 * /api/goals/{id}:
 *   put:
 *     summary: Update a goal
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Goal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               monthlySavings:
 *                 type: number
 *                 minimum: 0
 *               isWishlisted:
 *                 type: boolean
 *               savedAmount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Goal updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 goal:
 *                   $ref: '#/components/schemas/Goal'
 *       404:
 *         description: Goal not found
 */
router.put(
  '/:id',
  [
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage(MESSAGES.validation.positivePriceRequired),
    body('savedGoldAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage(MESSAGES.validation.positiveSavedGoldAmountRequired),
    body('recurringPlan.enabled').optional().isBoolean(),
    body('recurringPlan.frequency')
      .optional()
      .isIn(['weekly', 'monthly'])
      .withMessage(MESSAGES.validation.recurringFrequencyValid),
    body('recurringPlan.dayOfWeek')
      .optional()
      .isInt({ min: 0, max: 6 })
      .withMessage(MESSAGES.validation.recurringDayOfWeekValid),
    body('recurringPlan.dayOfMonth')
      .optional()
      .isInt({ min: 1, max: 28 })
      .withMessage(MESSAGES.validation.recurringDayOfMonthValid),
    body('recurringPlan.reminderHour')
      .optional()
      .isInt({ min: 0, max: 23 })
      .withMessage(MESSAGES.validation.recurringReminderHourValid),
  ],
  updateGoal
);

/**
 * @swagger
 * /api/goals/{id}:
 *   delete:
 *     summary: Delete a goal
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Goal ID
 *     responses:
 *       200:
 *         description: Goal deleted successfully
 *       404:
 *         description: Goal not found
 */
router.delete('/:id', deleteGoal);

/**
 * @swagger
 * /api/goals/{id}/wishlist:
 *   patch:
 *     summary: Toggle wishlist status for a goal
 *     tags: [Goals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Goal ID
 *     responses:
 *       200:
 *         description: Wishlist status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 goal:
 *                   $ref: '#/components/schemas/Goal'
 *       404:
 *         description: Goal not found
 */
router.patch('/:id/wishlist', toggleWishlist);

export default router;
