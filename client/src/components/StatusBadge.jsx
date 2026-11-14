import { label } from '../utils/format.js';

const TONES = {
  CONFIRMED: 'ok', AVAILABLE: 'ok', OPERATIONAL: 'ok',
  PENDING: 'warn', AFFECTED: 'bad', REJECTED: 'bad', UNAVAILABLE: 'bad', NON_OPERATIONAL: 'bad',
  CANCELLED: 'muted',
};

export default function StatusBadge({ status, text }) {
  return <span className={`badge ${TONES[status] || 'muted'}`}>{text || label(status)}</span>;
}
