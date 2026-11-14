import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { listForUser } from '../services/notificationService.js';

const router = Router();

router.get('/mine', authenticate, asyncHandler(async (req, res) => {
  res.json({ notifications: await listForUser(req.user.id) });
}));

export default router;
