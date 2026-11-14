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
