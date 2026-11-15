import prisma from '../config/prisma.js';
import AppError from '../utils/AppError.js';
import { assertInterval, assertNotPast, assertWithinBookingRules, formatIST, formatSlotIST } from '../utils/helpers.js';
import { lockRoom, roomConflict, findAlternatives, REASONS } from './availabilityService.js';
import { notifySafe, broadcastSafe } from './notificationService.js';
import { broadcast } from '../config/socket.js';

// TBD-01: roles whose bookings wait for HOD/admin approval. Everyone else is
// confirmed straight after the conflict check. Change this list to change the policy.
export const APPROVAL_ROLES = ['STUDENT'];

const ACTIVE = ['PENDING', 'CONFIRMED', 'AFFECTED'];

// ---- Who may review a pending request --------------------------------------------
// HODs and faculty review for their department, lab in-charges for labs of their
// department, and admins review everything. REVIEW_BY decides which department counts:
//   'either'    - the student's department OR the department that owns the room
//   'owner'     - only the department that owns the room
//   'requester' - only the student's own department
// A room with no owning department counts as owned by the student's department.
const REVIEW_BY = 'either';
const DEPARTMENT_REVIEWERS = ['HOD', 'FACULTY'];

function canReview(reviewer, booking) {
  if (reviewer.role === 'ADMIN') return true;
  const dept = reviewer.department;
  if (!dept) return false;
  const requesterMatch = booking.user.department === dept;
  const ownerMatch = (booking.room.department ?? booking.user.department) === dept;
  if (reviewer.role === 'LAB_INCHARGE') return booking.room.type === 'LAB' && ownerMatch;
  if (!DEPARTMENT_REVIEWERS.includes(reviewer.role)) return false;
  if (REVIEW_BY === 'owner') return ownerMatch;
  if (REVIEW_BY === 'requester') return requesterMatch;
  return requesterMatch || ownerMatch;
}

// The same rule written as a database filter, for the Approvals list.
function reviewableBy(reviewer) {
  const dept = reviewer.department;
  const requester = { user: { department: dept } };
  const owner = [{ room: { department: dept } }, { room: { department: null }, user: { department: dept } }];
  if (reviewer.role === 'LAB_INCHARGE') return { room: { type: 'LAB' }, OR: owner };
  if (REVIEW_BY === 'owner') return { OR: owner };
  if (REVIEW_BY === 'requester') return requester;
  return { OR: [requester, ...owner] };
}

class Unavailable extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

const isOverlapViolation = (err) => String(err?.message).includes('bookings_no_overlap');
const describe = (b) => `${b.room.name} on ${formatIST(b.startTime)} to ${formatIST(b.endTime)}`;

// Tells the requester's HOD (or, if the department has none, the admins) that a request is waiting.
async function notifyReviewers(booking, requester) {
  let reviewers = [];
  if (requester.department) {
    reviewers = await prisma.user.findMany({
      where: { role: 'HOD', department: requester.department, isActive: true },
      select: { id: true },
    });
  }
  if (reviewers.length === 0) {
    reviewers = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } });
  }
  for (const r of reviewers) {
    notifySafe(
      r.id,
      'REVIEW_REQUESTED',
      'New booking request to review',
      `${requester.name} (${requester.collegeId}) asked for ${describe(booking)} for ${booking.classStrength} students.\nPurpose: ${booking.purpose}`
    );
  }
}

// When a booking becomes CONFIRMED, any other PENDING request for the same room and an overlapping
// time can never be approved. Cancel those automatically. Call this inside the room lock.
async function cancelCompetingPending(tx, confirmed) {
  const competing = await tx.booking.findMany({
    where: {
      roomId: confirmed.roomId,
      status: 'PENDING',
      id: { not: confirmed.id },
      startTime: { lt: confirmed.endTime },
      endTime: { gt: confirmed.startTime },
    },
    include: { room: true },
  });
  if (competing.length) {
    await tx.booking.updateMany({
      where: { id: { in: competing.map((b) => b.id) } },
      data: { status: 'CANCELLED', reviewNote: 'Cancelled automatically: another booking for this room and time was approved.' },
    });
  }
  return competing;
}

const tellCancelled = (list) =>
  list.forEach((b) =>
    notifySafe(
      b.userId,
      'BOOKING_CANCELLED',
      'Request cancelled automatically',
      `Your request for ${describe(b)} was cancelled because another booking for the same room and time was approved. Please pick another room or time.`
    )
  );

// Campus-wide updates: only the room and the time, never who booked it.
const announceBooked = (room, start, end) =>
  broadcastSafe('ROOM_BOOKED', 'Room booked', `${room.name} is booked on ${formatSlotIST(start, end)}.`);
const announceFree = (room, start, end) =>
  broadcastSafe('ROOM_FREED', 'Room free again', `${room.name} is free again on ${formatSlotIST(start, end)}.`);

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
  assertWithinBookingRules(start, end);
  const room = await loadRoomFor(roomId, classStrength);

  let booking;
  let cancelledCompeting = [];
  try {
    ({ booking, cancelledCompeting } = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, roomId);
      const reason = await roomConflict(tx, room, start, end);
      if (reason) throw new Unavailable(reason);
      const created = await tx.booking.create({
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
      const cancelled = created.status === 'CONFIRMED' ? await cancelCompetingPending(tx, created) : [];
      return { booking: created, cancelledCompeting: cancelled };
    }));
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
  if (!confirmed) notifyReviewers(booking, user).catch((err) => console.error('reviewer notification failed:', err.message));
  if (confirmed) announceBooked(booking.room, booking.startTime, booking.endTime);
  tellCancelled(cancelledCompeting);
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
  if (booking.status === 'CONFIRMED') announceFree(booking.room, booking.startTime, booking.endTime);
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
  assertWithinBookingRules(next.start, next.end);
  const room = await loadRoomFor(next.roomId, next.classStrength);

  let updated;
  let cancelledCompeting = [];
  try {
    ({ updated, cancelledCompeting } = await prisma.$transaction(async (tx) => {
      await lockRoom(tx, next.roomId);
      const reason = await roomConflict(tx, room, next.start, next.end, id);
      if (reason) throw new Unavailable(reason);
      const saved = await tx.booking.update({
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
      const cancelled = saved.status === 'CONFIRMED' ? await cancelCompetingPending(tx, saved) : [];
      return { updated: saved, cancelledCompeting: cancelled };
    }));
  } catch (err) {
    if (err instanceof Unavailable || isOverlapViolation(err)) {
      throw await toConflictError(err, {
        start: next.start, end: next.end, classStrength: next.classStrength, type: room.type, excludeRoomId: next.roomId,
      });
    }
    throw err;
  }

  notifySafe(booking.userId, 'BOOKING_MODIFIED', 'Booking updated', `Your booking is now ${describe(updated)}.`);
  if (booking.status === 'CONFIRMED') announceFree(booking.room, booking.startTime, booking.endTime);
  if (updated.status === 'CONFIRMED') announceBooked(updated.room, updated.startTime, updated.endTime);
  tellCancelled(cancelledCompeting);
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
  if (!canReview(reviewer, booking)) {
    throw new AppError(403, 'This request is not for your department');
  }

  let updated;
  let cancelledCompeting = [];
  if (decision === 'REJECT') {
    updated = await prisma.booking.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: reviewer.id, reviewNote: note },
      include: { room: true },
    });
  } else {
    try {
      ({ updated, cancelledCompeting } = await prisma.$transaction(async (tx) => {
        await lockRoom(tx, booking.roomId);
        const reason = await roomConflict(tx, booking.room, booking.startTime, booking.endTime, id);
        if (reason) throw new Unavailable(reason);
        const saved = await tx.booking.update({
          where: { id },
          data: { status: 'CONFIRMED', reviewedById: reviewer.id, reviewNote: note },
          include: { room: true },
        });
        // Everyone else who asked for this room at this time is cancelled automatically.
        return { updated: saved, cancelledCompeting: await cancelCompetingPending(tx, saved) };
      }));
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
  if (approved) announceBooked(updated.room, updated.startTime, updated.endTime);
  tellCancelled(cancelledCompeting);
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
  const isAdmin = reviewer.role === 'ADMIN';
  if (!isAdmin && !reviewer.department) return Promise.resolve([]);
  return prisma.booking.findMany({
    where: {
      status: 'PENDING',
      endTime: { gt: new Date() },
      ...(isAdmin ? {} : reviewableBy(reviewer)),
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
