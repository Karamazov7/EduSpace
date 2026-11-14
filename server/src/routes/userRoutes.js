import { Router } from 'express';
import prisma from '../config/prisma.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { idParam } from '../utils/helpers.js';
import { userUpdateSchema } from '../validators/schemas.js';

const router = Router();
const ah = asyncHandler;
const SAFE = { id: true, collegeId: true, name: true, email: true, role: true, department: true, isActive: true, createdAt: true };

router.use(authenticate, authorize('ADMIN'));

// FR-006
router.get('/', ah(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const users = await prisma.user.findMany({
    where: q
      ? { OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { collegeId: { contains: q, mode: 'insensitive' } },
        ] }
      : {},
    select: SAFE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ users });
}));

router.patch('/:id', validate(userUpdateSchema), ah(async (req, res) => {
  const id = idParam(req);
  if (id === req.user.id && (req.body.isActive === false || (req.body.role && req.body.role !== 'ADMIN'))) {
    throw new AppError(400, 'You cannot demote or deactivate your own account');
  }
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'User not found');
  const user = await prisma.user.update({ where: { id }, data: req.body, select: SAFE });
  res.json({ user });
}));

export default router;
