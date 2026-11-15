import AppError from './AppError.js';

export const idParam = (req, name = 'id') => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n < 1) throw new AppError(400, `Invalid ${name}`);
  return n;
};

export const assertInterval = (start, end) => {
  if (!(end > start)) throw new AppError(400, 'End time must be after start time');
  if (end - start > 12 * 60 * 60 * 1000) {
    throw new AppError(400, 'A booking cannot be longer than 12 hours');
  }
};

export const assertNotPast = (start) => {
  if (start < new Date(Date.now() - 5 * 60 * 1000)) {
    throw new AppError(400, 'Start time is in the past');
  }
};

export const formatIST = (d) =>
  new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

// ---- Booking rules: opening hours and how far ahead rooms can be booked ---------------
export const OPEN_MINUTES = 8 * 60;    // 8:00 AM
export const CLOSE_MINUTES = 20 * 60;  // 8:00 PM
export const MAX_MONTHS_AHEAD = 1;
const TZ = 'Asia/Kolkata';

// The date ("2026-11-20") and the minutes since midnight of a moment, in Indian time.
export function istParts(d) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(d)).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// The last date that can still be booked: today plus one month, clamped to the end of that month.
export function latestBookableDate(now = new Date()) {
  const [y, m, d] = istParts(now).date.split('-').map(Number);
  const target = m - 1 + MAX_MONTHS_AHEAD; // zero-based month index
  const lastDay = new Date(Date.UTC(y, target + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, target, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

// Same day, between 8:00 AM and 8:00 PM, and not more than a month ahead.
export function assertWithinBookingRules(start, end) {
  const s = istParts(start);
  const e = istParts(end);
  if (s.date !== e.date) throw new AppError(400, 'A booking must start and end on the same day');
  if (s.minutes < OPEN_MINUTES || e.minutes > CLOSE_MINUTES) {
    throw new AppError(400, 'Rooms can only be booked between 8:00 AM and 8:00 PM');
  }
  const latest = latestBookableDate();
  if (s.date > latest) {
    throw new AppError(400, `Rooms can only be booked up to one month ahead (until ${latest})`);
  }
}

const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// What the web app needs to know to limit its date and time pickers.
export const bookingRules = () => ({
  openTime: hhmm(OPEN_MINUTES),
  closeTime: hhmm(CLOSE_MINUTES),
  latestDate: latestBookableDate(),
  timezone: TZ,
});

// "20 Nov 2026, 10:00 am to 11:00 am"
export const formatSlotIST = (start, end) =>
  `${formatIST(start)} to ${new Date(end).toLocaleTimeString('en-IN', { timeZone: TZ, timeStyle: 'short' })}`;
