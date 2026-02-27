import { Router } from 'express';
import { getGoldPrices, get18KPrice } from '../controllers/gold.controller';

const router: Router = Router();

/**
 * @swagger
 * /api/gold:
 *   get:
 *     summary: Get all gold prices
 *     tags: [Gold]
 *     responses:
 *       200:
 *         description: Gold prices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 gold:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Server error
 */
router.get('/', getGoldPrices);

/**
 * @swagger
 * /api/gold/18k:
 *   get:
 *     summary: Get 18K gold price per gram
 *     tags: [Gold]
 *     responses:
 *       200:
 *         description: 18K gold price retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 price:
 *                   type: number
 *                 unit:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get('/18k', get18KPrice);

export default router;
