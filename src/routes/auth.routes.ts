import { Router } from 'express';
import { body } from 'express-validator';
import {
  signUp,
  signIn,
  getMe,
  refreshAccessToken,
  logout,
  validateToken,
  logoutAllDevices,
  getActiveSessions,
  revokeSession,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { MESSAGES } from '../constants/messages';
import { createRateLimiter } from '../middleware/rateLimit';
import { validateRequest } from '../middleware/validateRequest';

const router: Router = Router();
const signInRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth:signin',
});
const signUpRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth:signup',
});
const refreshRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyPrefix: 'auth:refresh',
});

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation error or user already exists
 */
router.post(
  '/signup',
  signUpRateLimiter,
  [
    body('email').isEmail().withMessage(MESSAGES.validation.validEmailRequired),
    body('password').isLength({ min: 6 }).withMessage(MESSAGES.validation.passwordMin6),
    body('name').notEmpty().withMessage(MESSAGES.validation.nameRequired),
  ],
  validateRequest,
  signUp
);

/**
 * @swagger
 * /api/auth/signin:
 *   post:
 *     summary: Sign in an existing user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
router.post(
  '/signin',
  signInRateLimiter,
  [
    body('email').isEmail().withMessage(MESSAGES.validation.validEmailRequired),
    body('password').notEmpty().withMessage(MESSAGES.validation.passwordRequired),
  ],
  validateRequest,
  signIn
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/me', authenticateToken, getMe);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
  '/refresh',
  refreshRateLimiter,
  [body('refreshToken').notEmpty().withMessage(MESSAGES.validation.refreshTokenRequired)],
  validateRequest,
  refreshAccessToken
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and revoke refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post(
  '/logout',
  [body('refreshToken').notEmpty().withMessage(MESSAGES.validation.refreshTokenRequired)],
  validateRequest,
  logout
);

/**
 * @swagger
 * /api/auth/validate:
 *   get:
 *     summary: Validate current access token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid token
 */
router.get('/validate', authenticateToken, validateToken);

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 */
router.post('/logout-all', authenticateToken, logoutAllDevices);

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Get all active sessions
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active sessions
 */
router.get('/sessions', authenticateToken, getActiveSessions);

/**
 * @swagger
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke a specific session
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session revoked
 */
router.delete('/sessions/:sessionId', authenticateToken, revokeSession);

export default router;
