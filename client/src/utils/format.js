export const fmt = (d) =>
  new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export const fmtRange = (a, b) =>
  `${fmt(a)} to ${new Date(b).toLocaleTimeString('en-IN', { timeStyle: 'short' })}`;

// Combines a local date ("2026-11-20") and time ("09:30") into a UTC ISO string.
export const toISO = (date, time) => new Date(`${date}T${time}`).toISOString();

export const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export const errMsg = (err) =>
  err.response?.data?.message || err.message || 'Something went wrong';

export const fieldErrors = (err) =>
  (err.response?.data?.details || []).filter((d) => d.field).map((d) => `${d.field}: ${d.message}`);

export const label = (s = '') =>
  s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
