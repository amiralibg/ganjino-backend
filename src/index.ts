import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { connectDB, disconnectDB } from './config/database';
import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/auth.routes';
import goalRoutes from './routes/goal.routes';
import profileRoutes from './routes/profile.routes';
import goldRoutes from './routes/gold.routes';
import adminRoutes from './routes/admin.routes';
import savingsLogRoutes from './routes/savingsLog.routes';
import goldPriceHistoryRoutes from './routes/goldPriceHistory.routes';
import { errorHandler } from './middleware/errorHandler';
import { initializeCronJobs, stopCronJobs } from './services/cronJobs';
import { storeTodayGoldPrice } from './services/goldPriceService';
import { requestLogger } from './middleware/requestLogger';
import { Server } from 'http';

dotenv.config();

const app: Application = express();
const PORT = env.PORT;
const allowedCorsOrigins = env.CORS_ORIGIN;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (mobile apps, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV !== 'production' && allowedCorsOrigins.length === 0) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
  })
);
app.use(requestLogger);
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
  let server: Server | null = null;
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully...`);

    try {
      if (jobs) {
        stopCronJobs(jobs);
      }
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      }
      await disconnectDB();
      console.log('Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Graceful shutdown failed:', error);
      process.exit(1);
    }
  };

  let jobs: ReturnType<typeof initializeCronJobs> | null = null;

  try {
    await connectDB();

    // Initialize cron jobs for daily tasks
    jobs = initializeCronJobs();

    // Store today's gold price on startup
    try {
      await storeTodayGoldPrice();
    } catch {
      console.log('⚠️  Could not store gold price on startup (may already exist)');
    }

    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
    });

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
  } catch (error: unknown) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void startServer();
