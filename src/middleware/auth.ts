import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * Middleware that validates the Bearer token on every request.
 * Public paths (/ and /health) are exempted from authentication.
 */
export const authenticateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Allow public health/status endpoints without auth
  const publicPaths = ['/', '/health'];
  if (publicPaths.includes(req.path)) {
    next();
    return;
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: {
        message: 'Unauthorized: No Bearer token provided.',
        type: 'authentication_error',
        code: 'missing_token',
      },
    });
    return;
  }

  if (token !== config.apiKey) {
    res.status(403).json({
      error: {
        message: 'Forbidden: Invalid API key.',
        type: 'authentication_error',
        code: 'invalid_api_key',
      },
    });
    return;
  }

  next();
};