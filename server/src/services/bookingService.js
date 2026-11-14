import prisma from '../config/prisma.js';
import AppError from '../utils/AppError.js';
import { assertInterval, assertNotPast, formatIST } from '../utils/helpers.js';
import { lockRoom, roomConflict, findAlternatives, REASONS } from './availabilityService.js';
import { notifySafe } from './notificationService.js';
import { broadcast } from '../config/socket.js';

// TBD-01: roles whose bookings wait for HOD/admin approval. Everyone else is
// confirmed straight after the conflict check. Change this list to change the policy.
export const APPROVAL_ROLES = ['STUDENT'];

const ACTIVE = ['PENDING', 'CONFIRMED', 'AFFECTED'];

class Unavailable extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

const isOverlapViolation = (err) => String(err?.message).includes('bookings_no_overlap');
const describe = (b) => `${b.room.name} on ${formatIST(b.startTime)} to ${formatIST(b.endTime)}`;

async function toConflictError(err, ctx) {
  const reason = err instanceof Unavailable ? err.reason : 'BOOKED';
  const alternatives = await findAlternatives(ctx);
  return new AppError(409, REASONS[reason], { reason, alternatives });
}

async function getManageable(user, id) {
  const booking = await prisma.booking.findUnique({ where: { id }, include: { room: true } });
  if (!booking) throw new AppError(404, 'Booking not found');
  if (booking.userId !== user.id && user.role !== 'ADMIN') {
    throw new AppError(403, 'You can only manage your own bookings');
  }
  return booking;
}

async function loadRoomFor(roomId, classStrength) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) throw new AppError(404, 'Room not found');
  if (classStrength > room.capacity) {
    throw new AppError(422, `${room.name} seats ${room.capacity}, but the class strength is ${classStrength}`);
  }
  return room;
}

// FR-017 to FR-025
export async function createBooking(user, { roomId, classStrength, purpose, start, end }) {
  assertInterval(start, end);
  assertNotPast(start);
  const room = await loadRoomFor(roomId, classStrength);

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, roomId);
      const reason = await roomConflict(tx, room, start, end);
      if (reason) throw new Unavailable(reason);
      return tx.booking.create({
        data: {
          userId: user.id,
          roomId,
          collegeId: user.collegeId,
          classStrength,
          purpose,
          startTime: start,
          endTime: end,
          status: APPROVAL_ROLES.includes(user.role) ? 'PENDING' : 'CONFIRMED',
        },
        include: { room: true },
      });
    });
  } catch (err) {
    if (err instanceof Unavailable || isOverlapViolation(err)) {
      throw await toConflictError(err, { start, end, classStrength, type: room.type, excludeRoomId: roomId });
    }
    throw err;
  }

  const confirmed = booking.status === 'CONFIRMED';
  notifySafe(
    user.id,
    confirmed ? 'BOOKING_CONFIRMED' : 'BOOKING_SUBMITTED',
    confirmed ? 'Booking confirmed' : 'Booking request received',
    confirmed
      ? `Your booking for ${describe(booking)} is confirmed.`
      : `Your request for ${describe(booking)} is waiting for HOD/admin approval.`
  );
  broadcast('availability:changed');
  return booking;
}

// FR-031, FR-032
export async function cancelBooking(user, id) {
  const booking = await getManageable(user, id);
  if (!ACTIVE.includes(booking.status)) {
    throw new AppError(409, `A ${booking.status.toLowerCase()} booking cannot be cancelled`);
  }
  if (booking.startTime <= new Date() && user.role !== 'ADMIN') {
    throw new AppError(409, 'A booking that has already started cannot be cancelled');
  }
  const updated = await prisma.booking.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: { room: true },
  });
  notifySafe(booking.userId, 'BOOKING_CANCELLED', 'Booking cancelled', `Your booking for ${describe(updated)} was cancelled.`);
  broadcast('availability:changed');
  return updated;
}

// FR-033, FR-040: change time/room, or pick a replacement room after maintenance.
export async function modifyBooking(user, id, changes) {
  const booking = await getManageable(user, id);
  if (!ACTIVE.includes(booking.status)) {
    throw new AppError(409, `A ${booking.status.toLowerCase()} booking cannot be changed`);
  }
  const next = {
    roomId: changes.roomId ?? booking.roomId,
    start: changes.start ?? booking.startTime,
    end: changes.end ?? booking.endTime,
    classStrength: changes.classStrength ?? booking.classStrength,
    purpose: changes.purpose ?? booking.purpose,
  };
  assertInterval(next.start, next.end);
  assertNotPast(next.start);
  const room = await loadRoomFor(next.roomId, next.classStrength);

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, next.roomId);
      const reason = await roomConflict(tx, room, next.start, next.end, id);
      if (reason) throw new Unavailable(reason);
      return tx.booking.update({
        where: { id },
        data: {
          roomId: next.roomId,
          startTime: next.start,
          endTime: next.end,
          classStrength: next.classStrength,
          purpose: next.purpose,
          status: booking.status === 'PENDING' ? 'PENDING' : 'CONFIRMED',
        },
        include: { room: true },
      });
    });
  } catch (err) {
    if (err instanceof Unavailable || isOverlapViolation(err)) {
      throw await toConflictError(err, {
        start: next.start, end: next.end, classStrength: next.classStrength, type: room.type, excludeRoomId: next.roomId,
      });
    }
    throw err;
  }

  notifySafe(booking.userId, 'BOOKING_MODIFIED', 'Booking updated', `Your booking is now ${describe(updated)}.`);
  broadcast('availability:changed');
  return updated;
}

// FR-048 to FR-050
export async function reviewBooking(reviewer, id, decision, note) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { room: true, user: { select: { department: true } } },
  });
  if (!booking) throw new AppError(404, 'Booking not found');
  if (booking.status !== 'PENDING') throw new AppError(409, 'Only pending requests can be reviewed');
  if (reviewer.role === 'HOD' && reviewer.department && booking.user.department !== reviewer.department) {
    throw new AppError(403, 'This request belongs to another department');
  }

  let updated;
  if (decision === 'REJECT') {
    updated = await prisma.booking.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: reviewer.id, reviewNote: note },
      include: { room: true },
    });
  } else {
    try {
      updated = await prisma.$transaction(async (tx) => {
        await lockRoom(tx, booking.roomId);
        const reason = await roomConflict(tx, booking.room, booking.startTime, booking.endTime, id);
        if (reason) throw new Unavailable(reason);
        return tx.booking.update({
          where: { id },
          data: { status: 'CONFIRMED', reviewedById: reviewer.id, reviewNote: note },
          include: { room: true },
        });
      });
    } catch (err) {
      if (err instanceof Unavailable || isOverlapViolation(err)) {
        const reason = err instanceof Unavailable ? err.reason : 'BOOKED';
        throw new AppError(409, `${REASONS[reason]}. Reject this request so the requester can book another room.`, { reason });
      }
      throw err;
    }
  }

  const approved = decision !== 'REJECT';
  notifySafe(
    booking.userId,
    approved ? 'BOOKING_APPROVED' : 'BOOKING_REJECTED',
    approved ? 'Booking approved' : 'Booking rejected',
    `Your request for ${describe(updated)} was ${approved ? 'approved' : 'rejected'}.${note ? ` Note: ${note}` : ''}`
  );
  broadcast('availability:changed');
  return updated;
}

// FR-030, FR-051
export const listMine = (userId) =>
  prisma.booking.findMany({
    where: { userId },
    include: { room: true },
    orderBy: { startTime: 'desc' },
  });

// Oldest request first: FIFO/FCFS ordering for reviewers (FR-022).
export function listPending(reviewer) {
  const departmentOnly = reviewer.role === 'HOD' && reviewer.department;
  return prisma.booking.findMany({
    where: {
      status: 'PENDING',
      endTime: { gt: new Date() },
      ...(departmentOnly && { user: { department: reviewer.department } }),
    },
    include: { room: true, user: { select: { name: true, collegeId: true, department: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// FR-039: replacement rooms for a booking (used after a maintenance block).
export async function alternativesFor(user, id) {
  const b = await getManageable(user, id);
  return findAlternatives({
    start: b.startTime, end: b.endTime, classStrength: b.classStrength, type: b.room.type, excludeRoomId: b.roomId,
  });
}
