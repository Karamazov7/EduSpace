import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { listForUser, listBroadcasts } from '../services/notificationService.js';

const router = Router();

// Messages meant for you.
router.get('/mine', authenticate, asyncHandler(async (req, res) => {
  res.json({ notifications: await listForUser(req.user.id) });
}));

// Campus-wide updates, the same for every registered user.
router.get('/campus', authenticate, asyncHandler(async (req, res) => {
  res.json({ broadcasts: await listBroadcasts() });
}));

export default router;
