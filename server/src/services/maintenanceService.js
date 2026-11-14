import prisma from '../config/prisma.js';
import AppError from '../utils/AppError.js';
import { lockRoom } from './availabilityService.js';
import { notifySafe } from './notificationService.js';
import { broadcast } from '../config/socket.js';
import { formatIST } from '../utils/helpers.js';

// FR-035 to FR-039
export async function createBlock(user, { roomId, reason, startDate, endDate }) {
  if (!(endDate > startDate)) throw new AppError(400, 'End date must be after start date');
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError(404, 'Room not found');

  const now = new Date();
  const { block, affected } = await prisma.$transaction(async (tx) => {
    await lockRoom(tx, roomId);
    const block = await tx.maintenanceBlock.create({
      data: { roomId, reason, startDate, endDate, createdById: user.id },
    });
    const affected = await tx.booking.findMany({
      where: {
        roomId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startTime: { lt: endDate },
        endTime: { gt: startDate > now ? startDate : now },
      },
    });
    if (affected.length) {
      await tx.booking.updateMany({
        where: { id: { in: affected.map((b) => b.id) } },
        data: { status: 'AFFECTED' },
      });
    }
    return { block, affected };
  });

  for (const b of affected) {
    notifySafe(
      b.userId,
      'BOOKING_AFFECTED',
      'Your booking is affected by maintenance',
      `${room.name} is blocked for maintenance (${reason}). Your booking on ${formatIST(b.startTime)} needs a new room. Open "My bookings" to pick an alternative.`
    );
  }
  broadcast('availability:changed');
  return { block, affectedCount: affected.length };
}

// FR-042
export async function completeBlock(id) {
  const block = await prisma.maintenanceBlock.findUnique({ where: { id } });
  if (!block) throw new AppError(404, 'Maintenance record not found');
  if (block.completedAt) throw new AppError(409, 'This maintenance is already marked complete');
  const updated = await prisma.maintenanceBlock.update({ where: { id }, data: { completedAt: new Date() } });
  broadcast('availability:changed');
  return updated;
}

export const listBlocks = () =>
  prisma.maintenanceBlock.findMany({
    include: { room: { select: { name: true } }, createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
