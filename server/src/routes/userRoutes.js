import { Router } from 'express';
import prisma from '../config/prisma.js';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import AppError from '../utils/AppError.js';
import { idParam } from '../utils/helpers.js';
import { userUpdateSchema, roleChangeSchema } from '../validators/schemas.js';
import * as passwordResets from '../services/passwordResetService.js';

const router = Router();
const ah = asyncHandler;
const SAFE = { id: true, collegeId: true, name: true, email: true, role: true, department: true, isActive: true, createdAt: true };

// Which roles a HOD or a faculty member may hand out and take back, inside their own department.
//   HOD:     student <-> class representative <-> faculty
//   Faculty: student <-> class representative
const MANAGEABLE_ROLES = {
  HOD: ['STUDENT', 'CLASS_REPRESENTATIVE', 'FACULTY'],
  FACULTY: ['STUDENT', 'CLASS_REPRESENTATIVE'],
};

const nameSearch = (q) =>
  q ? { OR: [
    { name: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
    { collegeId: { contains: q, mode: 'insensitive' } },
  ] } : {};

router.use(authenticate);

// ---- HOD and faculty: manage roles inside their own department -------------------

// People in my department whose role I am allowed to change.
router.get('/department', authorize('HOD', 'FACULTY'), ah(async (req, res) => {
  if (!req.user.department) {
    throw new AppError(400, 'Your account has no department yet. Ask an admin to set it.');
  }
  const users = await prisma.user.findMany({
    where: {
      department: req.user.department,
      role: { in: MANAGEABLE_ROLES[req.user.role] },
      isActive: true,
      ...nameSearch(String(req.query.q || '').trim()),
    },
    select: SAFE,
    orderBy: { name: 'asc' },
    take: 200,
  });
  res.json({ users, department: req.user.department, allowedRoles: MANAGEABLE_ROLES[req.user.role] });
}));

router.patch('/:id/role', authorize('HOD', 'FACULTY'), validate(roleChangeSchema), ah(async (req, res) => {
  const id = idParam(req);
  const allowed = MANAGEABLE_ROLES[req.user.role];
  if (id === req.user.id) throw new AppError(400, 'You cannot change your own role');

  const target = await prisma.user.findUnique({ where: { id }, select: SAFE });
  if (!target) throw new AppError(404, 'User not found');
  if (!req.user.department || target.department !== req.user.department) {
    throw new AppError(403, 'You can only change roles inside your own department');
  }
  if (!allowed.includes(target.role) || !allowed.includes(req.body.role)) {
    throw new AppError(403, `You can only switch people between: ${allowed.join(', ').toLowerCase().replace(/_/g, ' ')}`);
  }
  const user = await prisma.user.update({ where: { id }, data: { role: req.body.role }, select: SAFE });
  res.json({ user });
}));

// ---- Admin: manage everyone (FR-006) ---------------------------------------------

router.get('/', authorize('ADMIN'), ah(async (req, res) => {
  const users = await prisma.user.findMany({
    where: nameSearch(String(req.query.q || '').trim()),
    select: SAFE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ users });
}));

// ---- Admin: password resets (forgot password) --------------------------------------

router.get('/reset-requests', authorize('ADMIN'), ah(async (req, res) => {
  res.json({ requests: await passwordResets.listRequests() });
}));

router.post('/reset-requests/:rid/close', authorize('ADMIN'), ah(async (req, res) => {
  await passwordResets.closeRequest(idParam(req, 'rid'));
  res.status(204).end();
}));

// Creates a one-time reset link for this person. The admin hands it over; the link is shown only once.
router.post('/:id/reset-link', authorize('ADMIN'), ah(async (req, res) => {
  res.json(await passwordResets.issueLink(req.user, idParam(req)));
}));

router.patch('/:id', authorize('ADMIN'), validate(userUpdateSchema), ah(async (req, res) => {
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
