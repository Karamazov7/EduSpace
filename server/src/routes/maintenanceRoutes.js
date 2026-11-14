import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { idParam } from '../utils/helpers.js';
import * as maintenance from '../services/maintenanceService.js';
import { maintenanceSchema } from '../validators/schemas.js';

const router = Router();
const ah = asyncHandler;
const STAFF = ['ADMIN', 'MAINTENANCE_STAFF', 'LAB_INCHARGE'];

router.use(authenticate, authorize(...STAFF));

router.get('/', ah(async (req, res) => {
  res.json({ blocks: await maintenance.listBlocks() });
}));

router.post('/', validate(maintenanceSchema), ah(async (req, res) => {
  const result = await maintenance.createBlock(req.user, req.body);
  res.status(201).json(result);
}));

router.patch('/:id/complete', ah(async (req, res) => {
  res.json({ block: await maintenance.completeBlock(idParam(req)) });
}));

export default router;
