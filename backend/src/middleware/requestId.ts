import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to attach a unique request ID to each incoming request.
 * The request ID is used for tracing and debugging purposes.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate a unique request ID
  const requestId = uuidv4().slice(0, 8);
  
  // Attach to request object for use in other middleware and routes
  (req as any).id = requestId;
  
  // Set response header
  res.setHeader('X-Request-ID', requestId);
  
  // Add to response locals for potential use in views/templates
  res.locals.requestId = requestId;
  
  next();
}

/**
 * Middleware to log request start and end with request ID
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = (req as any).id || 'unknown';
  
  // Log request start
  console.log(`[${new Date().toISOString()}] [REQ ${requestId}] ${req.method} ${req.path} - Started`);
  
  // Hook into response finish to log completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusColor = statusCode >= 500 ? '\x1b[31m' : // red for 5xx
                       statusCode >= 400 ? '\x1b[33m' : // yellow for 4xx
                       statusCode >= 300 ? '\x1b[36m' : // cyan for 3xx
                       '\x1b[32m'; // green for 2xx
    
    console.log(`[${new Date().toISOString()}] [RES ${requestId}] ${req.method} ${req.path} - ${statusColor}${statusCode}\x1b[0m ${duration}ms`);
  });
  
  next();
}