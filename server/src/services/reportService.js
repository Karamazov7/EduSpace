import prisma from '../config/prisma.js';
import AppError from '../utils/AppError.js';

// FR-052: utilisation = confirmed hours / (days in range x operating hours per day).
export async function utilization(from, to) {
  if (!(to > from)) throw new AppError(400, 'End date must be after start date');
  const days = Math.max(1, Math.ceil((to - from) / 86400000));
  const hoursPerDay = Number(process.env.OPERATING_HOURS_PER_DAY) || 10;
  const capacityHours = days * hoursPerDay;

  const [rooms, confirmed, byStatus] = await Promise.all([
    prisma.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.booking.findMany({
      where: { status: 'CONFIRMED', startTime: { gte: from }, endTime: { lte: to } },
      include: { user: { select: { department: true } } },
    }),
    prisma.booking.groupBy({
      by: ['status'],
      where: { startTime: { gte: from }, endTime: { lte: to } },
      _count: { _all: true },
    }),
  ]);

  const perRoom = new Map(rooms.map((r) => [r.id, { id: r.id, name: r.name, type: r.type, bookings: 0, hours: 0 }]));
  const perDept = new Map();
  for (const b of confirmed) {
    const hours = (b.endTime - b.startTime) / 3600000;
    const row = perRoom.get(b.roomId);
    if (row) { row.bookings += 1; row.hours += hours; }
    const dept = b.user.department || 'Unassigned';
    perDept.set(dept, (perDept.get(dept) || 0) + 1);
  }

  const roomRows = [...perRoom.values()].map((r) => ({
    ...r,
    hours: Math.round(r.hours * 10) / 10,
    utilizationPct: Math.min(100, Math.round((r.hours / capacityHours) * 1000) / 10),
  }));
  const totalHours = roomRows.reduce((s, r) => s + r.hours, 0);

  return {
    range: { from, to, days },
    totals: {
      confirmedBookings: confirmed.length,
      bookedHours: Math.round(totalHours * 10) / 10,
      averageUtilizationPct: roomRows.length
        ? Math.round((roomRows.reduce((s, r) => s + r.utilizationPct, 0) / roomRows.length) * 10) / 10
        : 0,
    },
    rooms: roomRows,
    byDepartment: [...perDept].map(([department, count]) => ({ department, count })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
  };
}
