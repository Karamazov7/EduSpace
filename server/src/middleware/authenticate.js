import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toPublicUser } from '../services/authService.js';

const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Authentication required');
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  // Re-check the DB so deactivated users or role changes take effect immediately
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.isActive) {
    throw new AppError(401, 'Account not found or deactivated');
  }

  // A password reset invalidates every login token issued before it.
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new AppError(401, 'Your password was changed. Please log in again.');
  }

  req.user = toPublicUser(user);
  next();
});

export default authenticate;
