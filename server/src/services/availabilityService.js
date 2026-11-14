import prisma from '../config/prisma.js';

export const REASONS = {
  BOOKED: 'Already booked for this time',
  MAINTENANCE: 'Blocked for maintenance',
  NON_OPERATIONAL: 'Marked non-operational',
};

// Serialises concurrent bookings for one room: the first request to take the lock
// is checked (and saved) first, later ones wait and then see its booking (FR-022/023).
export const lockRoom = (tx, roomId) =>
  tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;

// Returns null if the room is free for [start, end), otherwise the reason code.
// A maintenance block stays in force until staff mark it completed (FR-041).
export async function roomConflict(db, room, start, end, excludeBookingId) {
  if (!room.isActive || room.status !== 'OPERATIONAL') return 'NON_OPERATIONAL';

  const block = await db.maintenanceBlock.findFirst({
    where: { roomId: room.id, completedAt: null, startDate: { lt: end } },
    select: { id: true },
  });
  if (block) return 'MAINTENANCE';

  const clash = await db.booking.findFirst({
    where: {
      roomId: room.id,
      status: 'CONFIRMED',
      startTime: { lt: end },
      endTime: { gt: start },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
    },
    select: { id: true },
  });
  return clash ? 'BOOKED' : null;
}

// FR-012 to FR-016: every active room matching the filters, flagged available or not.
export async function searchRooms({ start, end, type, capacity }) {
  const rooms = await prisma.room.findMany({
    where: {
      isActive: true,
      ...(type && { type }),
      ...(capacity && { capacity: { gte: capacity } }),
    },
    include: { equipment: true },
    orderBy: [{ capacity: 'asc' }, { name: 'asc' }],
  });
  const ids = rooms.map((r) => r.id);

  const [booked, blocked] = await Promise.all([
    prisma.booking.findMany({
      where: { roomId: { in: ids }, status: 'CONFIRMED', startTime: { lt: end }, endTime: { gt: start } },
      select: { roomId: true },
    }),
    prisma.maintenanceBlock.findMany({
      where: { roomId: { in: ids }, completedAt: null, startDate: { lt: end } },
      select: { roomId: true },
    }),
  ]);
  const bookedIds = new Set(booked.map((b) => b.roomId));
  const blockedIds = new Set(blocked.map((b) => b.roomId));

  return rooms.map((room) => {
    let reason = null;
    if (room.status !== 'OPERATIONAL') reason = 'NON_OPERATIONAL';
    else if (blockedIds.has(room.id)) reason = 'MAINTENANCE';
    else if (bookedIds.has(room.id)) reason = 'BOOKED';
    return { ...room, available: reason === null, reason, reasonText: reason && REASONS[reason] };
  });
}

// FR-026 to FR-028: same time slot, enough seats, same kind of room, smallest fit first.
export async function findAlternatives({ start, end, classStrength, type, excludeRoomId }) {
  const rooms = await searchRooms({ start, end, type, capacity: classStrength });
  return rooms.filter((r) => r.available && r.id !== excludeRoomId).slice(0, 6);
}
