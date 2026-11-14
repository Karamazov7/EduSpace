import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { utilization } from '../services/reportService.js';
import { reportSchema } from '../validators/schemas.js';

const router = Router();

router.get('/utilization', authenticate, authorize('ADMIN', 'HOD', 'MANAGEMENT'),
  validate(reportSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { from, to } = req.validated;
    res.json(await utilization(from, to));
  })
);

export default router;
