import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import AppError from '../utils/AppError.js';
import { notifySafe } from './notificationService.js';

const SALT_ROUNDS = 12;
const LINK_VALID_HOURS = 24;
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const INVALID = 'This reset link is invalid or has expired. Ask an administrator for a new one.';

// PUBLIC. The caller always gets the same answer, so nobody can use this form to find out
// who has an account. A request is only recorded when email and college ID both match.
export async function requestReset({ email, collegeId }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;
  if (user.collegeId.trim().toLowerCase() !== collegeId.trim().toLowerCase()) return;

  const alreadyWaiting = await prisma.passwordReset.findFirst({ where: { userId: user.id, status: 'REQUESTED' } });
  if (alreadyWaiting) return;

  await prisma.passwordReset.create({ data: { userId: user.id } });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  for (const admin of admins) {
    notifySafe(
      admin.id,
      'PASSWORD_RESET_REQUESTED',
      'Password reset requested',
      `${user.name} (${user.collegeId}) asked for a password reset. Open Users to create a reset link.`
    );
  }
}

// ADMIN. Creates a one-time link. Any older unused link for the same person stops working.
export async function issueLink(admin, userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');
  if (!user.isActive) throw new AppError(409, 'This account is deactivated');

  const token = crypto.randomBytes(32).toString('hex'); // 64 characters, only its hash is stored
  const expiresAt = new Date(Date.now() + LINK_VALID_HOURS * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.passwordReset.updateMany({ where: { userId, status: { in: ['REQUESTED', 'ISSUED'] } }, data: { status: 'CLOSED' } }),
    prisma.passwordReset.create({ data: { userId, status: 'ISSUED', tokenHash: sha256(token), expiresAt, issuedById: admin.id } }),
  ]);

  const base = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  return {
    link: `${base}/reset-password?token=${token}`,
    expiresAt,
    user: { id: user.id, name: user.name, email: user.email, collegeId: user.collegeId },
  };
}

// ADMIN. People waiting for a link, oldest first.
export const listRequests = () =>
  prisma.passwordReset.findMany({
    where: { status: 'REQUESTED' },
    include: { user: { select: { id: true, name: true, email: true, collegeId: true, department: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });

export async function closeRequest(id) {
  const closed = await prisma.passwordReset.updateMany({ where: { id, status: 'REQUESTED' }, data: { status: 'CLOSED' } });
  if (closed.count !== 1) throw new AppError(404, 'Request not found or already handled');
}

// PUBLIC. Spends the one-time link and sets the new password.
export async function resetPassword({ token, password }) {
  const record = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!record || record.status !== 'ISSUED' || record.expiresAt < new Date() || !record.user.isActive) {
    throw new AppError(400, INVALID);
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    // Claim the link first, so two people using it at the same moment cannot both succeed.
    const claimed = await tx.passwordReset.updateMany({
      where: { id: record.id, status: 'ISSUED' },
      data: { status: 'USED', usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError(400, INVALID);
    // passwordChangedAt makes every login token issued before now stop working.
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: new Date() } });
    await tx.passwordReset.updateMany({
      where: { userId: record.userId, status: { in: ['REQUESTED', 'ISSUED'] }, id: { not: record.id } },
      data: { status: 'CLOSED' },
    });
  });

  notifySafe(record.userId, 'PASSWORD_CHANGED', 'Your password was changed',
    'Your password was reset. If this was not you, contact an administrator right away.');
}
