import { Router } from 'express';
import { param, query } from 'express-validator';
import {
  getAllUsers,
  getUserDetails,
  toggleUserStatus,
  promoteToAdmin,
  demoteAdminToUser,
  getSecurityInsights,
  getDashboardStats,
} from '../controllers/admin.controller';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin, requireAdminPermission, requireSuperAdmin } from '../middleware/adminAuth';
import { validateRequest } from '../middleware/validateRequest';

const router: Router = Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *       403:
 *         description: Forbidden - Admin only
 */
router.get('/stats', requireAdminPermission('admin.read'), getDashboardStats);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get(
  '/users',
  requireAdminPermission('admin.read'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString().trim(),
    query('role').optional().isIn(['all', 'user', 'admin', 'super_admin']),
    query('status').optional().isIn(['all', 'active', 'inactive']),
    query('sortBy').optional().isIn(['createdAt', 'name', 'email']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
  ],
  validateRequest,
  getAllUsers
);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Get user details with sessions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User details
 */
router.get(
  '/users/:userId',
  requireAdminPermission('admin.read'),
  [param('userId').isMongoId()],
  validateRequest,
  getUserDetails
);

/**
 * @swagger
 * /api/admin/users/{userId}/toggle-status:
 *   patch:
 *     summary: Activate or deactivate user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User status updated
 */
router.patch(
  '/users/:userId/toggle-status',
  requireSuperAdmin,
  [param('userId').isMongoId()],
  validateRequest,
  toggleUserStatus
);

/**
 * @swagger
 * /api/admin/users/{userId}/promote:
 *   patch:
 *     summary: Promote user to admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User promoted
 */
router.patch(
  '/users/:userId/promote',
  requireAdminPermission('admin.roles.manage'),
  [param('userId').isMongoId()],
  validateRequest,
  promoteToAdmin
);

/**
 * @swagger
 * /api/admin/users/{userId}/demote:
 *   patch:
 *     summary: Demote admin to user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User demoted
 */
router.patch(
  '/users/:userId/demote',
  requireAdminPermission('admin.roles.manage'),
  [param('userId').isMongoId()],
  validateRequest,
  demoteAdminToUser
);

/**
 * @swagger
 * /api/admin/security/insights:
 *   get:
 *     summary: Get security insights and suspicious activities
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Security insights
 */
router.get('/security/insights', requireAdminPermission('admin.security.read'), getSecurityInsights);

export default router;
