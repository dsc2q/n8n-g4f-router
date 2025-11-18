import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export const authenticateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (req.path === '/') {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token not provided.' });
  }

  if (token !== config.apiKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid token.' });
  }

  next();
};