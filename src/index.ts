import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './config/database';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/auth.routes';
import goalRoutes from './routes/goal.routes';
import profileRoutes from './routes/profile.routes';
import goldRoutes from './routes/gold.routes';
import adminRoutes from './routes/admin.routes';
import savingsLogRoutes from './routes/savingsLog.routes';
import goldPriceHistoryRoutes from './routes/goldPriceHistory.routes';
import { errorHandler } from './middleware/errorHandler';
import { initializeCronJobs } from './services/cronJobs';
import { storeTodayGoldPrice } from './services/goldPriceService';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/gold', goldRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logs', savingsLogRoutes);
app.use('/api/gold-history', goldPriceHistoryRoutes);

// Error handler
app.use(errorHandler);

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    // Initialize cron jobs for daily tasks
    initializeCronJobs();

    // Store today's gold price on startup
    try {
      await storeTodayGoldPrice();
    } catch {
      console.log('⚠️  Could not store gold price on startup (may already exist)');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error: unknown) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void startServer();
