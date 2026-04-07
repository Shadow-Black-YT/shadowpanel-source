import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  const errorId = uuidv4().slice(0, 8);
  const requestId = (req as any).id || errorId;
  
  // AppError handling
  if (err instanceof AppError) {
    logger.warn(`[${req.method} ${req.path}] AppError ${err.statusCode}: ${err.message}`, {
      errorId,
      requestId,
      code: err.code,
      details: err.details,
      userId: (req as any).user?.id,
    });
    
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      errorId,
      powered_by: 'shadowblack',
    });
    return;
  }

  // PostgreSQL errors
  const pgErrors: Record<string, { status: number; message: string }> = {
    '23505': { status: 409, message: 'Resource already exists' },
    '23503': { status: 400, message: 'Referenced resource not found' },
    '23502': { status: 400, message: 'Required field is missing' },
    '22P02': { status: 400, message: 'Invalid input syntax' },
    '42703': { status: 400, message: 'Invalid column reference' },
    '42P01': { status: 500, message: 'Database table not found' },
    '08006': { status: 503, message: 'Database connection failed' },
  };

  if (err.code && pgErrors[err.code]) {
    const pgError = pgErrors[err.code];
    logger.warn(`[${req.method} ${req.path}] PostgreSQL ${err.code}: ${pgError.message}`, {
      errorId,
      requestId,
      pgCode: err.code,
      detail: err.detail,
      table: err.table,
      constraint: err.constraint,
    });
    
    res.status(pgError.status).json({
      error: pgError.message,
      code: err.code,
      errorId,
      powered_by: 'shadowblack',
    });
    return;
  }

  // Validation errors (Zod, etc.)
  if (err.name === 'ZodError') {
    const issues = err.issues?.map((issue: any) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    
    logger.warn(`[${req.method} ${req.path}] Validation error`, {
      errorId,
      requestId,
      issues,
    });
    
    res.status(400).json({
      error: 'Validation failed',
      issues,
      errorId,
      powered_by: 'shadowblack',
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    logger.warn(`[${req.method} ${req.path}] JWT error: ${err.message}`, {
      errorId,
      requestId,
    });
    
    res.status(401).json({
      error: 'Authentication failed',
      errorId,
      powered_by: 'shadowblack',
    });
    return;
  }

  // Rate limit errors
  if (err.statusCode === 429) {
    logger.warn(`[${req.method} ${req.path}] Rate limit exceeded`, {
      errorId,
      requestId,
      ip: req.ip,
    });
    
    res.status(429).json({
      error: 'Too many requests, please try again later',
      errorId,
      powered_by: 'shadowblack',
    });
    return;
  }

  // Unknown error - log with full context
  logger.error(`[${req.method} ${req.path}] Unhandled error: ${err.message}`, {
    errorId,
    requestId,
    stack: err.stack,
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
  });

  // In production, don't expose stack traces
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: isProduction ? 'Internal server error' : err.message,
    errorId,
    powered_by: 'shadowblack',
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
