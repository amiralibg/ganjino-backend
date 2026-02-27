import { Router } from 'express';
import { body } from 'express-validator';
import { getProfile, updateProfile } from '../controllers/profile.controller';
import { authenticateToken } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';

const router: Router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profile not found
 *       401:
 *         description: Unauthorized
 */
router.get('/', getProfile);

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update the authenticated user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monthlySalary:
 *                 type: number
 *                 minimum: 0
 *               currency:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put(
  '/',
  [
    body('monthlySalary')
      .optional()
      .isFloat({ min: 0 })
      .withMessage(MESSAGES.validation.monthlySalaryPositive),
    body('currency').optional().isString().withMessage(MESSAGES.validation.currencyString),
    body('monthlySavingsPercentage')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage(MESSAGES.validation.monthlySavingsPercentageRange),
    body('notificationsEnabled').optional().isBoolean(),
    body('expoPushToken').optional().isString(),
    body('goldPriceAlertThreshold')
      .optional()
      .isFloat({ min: 0 })
      .withMessage(MESSAGES.validation.amountPositive),
  ],
  updateProfile
);

export default router;
