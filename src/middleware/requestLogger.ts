import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

export const requestLogger = (req: RequestWithId, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const incomingId = req.header('x-request-id');
  const requestId = incomingId && incomingId.trim() ? incomingId : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const path = req.originalUrl || req.url;
  console.log(`[${requestId}] -> ${req.method} ${path}`);

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(`[${requestId}] <- ${req.method} ${path} ${res.statusCode} ${durationMs}ms`);
  });

  next();
};
