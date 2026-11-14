import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useRefreshOnChange } from '../api/socket.js';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { errMsg, fmtRange } from '../utils/format.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [relocating, setRelocating] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings/mine');
      setBookings(data.bookings);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnChange(load);

  const cancel = async (b) => {
    if (!window.confirm(`Cancel your booking for ${b.room.name}?`)) return;
    setError(''); setNotice('');
    try {
      await api.patch(`/bookings/${b.id}/cancel`);
      setNotice('Booking cancelled. The room is free again.');
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  if (!bookings) return <p className="muted">{error || 'Loading...'}</p>;

  const now = new Date();
  const affected = bookings.filter((b) => b.status === 'AFFECTED');
  const current = bookings.filter((b) => b.status === 'CONFIRMED' && new Date(b.startTime) <= now && new Date(b.endTime) > now);
  const upcoming = bookings.filter((b) => ['PENDING', 'CONFIRMED'].includes(b.status) && new Date(b.startTime) > now);
  const shown = new Set([...affected, ...current, ...upcoming].map((b) => b.id));
  const previous = bookings.filter((b) => !shown.has(b.id));
  const tabs = { upcoming, current, previous };

  return (
    <>
      <div className="page-head"><h1>My bookings</h1></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {affected.length > 0 && (
        <div className="alert info">
          <strong>{affected.length} booking{affected.length > 1 ? 's need' : ' needs'} a new room</strong> because the room is blocked for maintenance.
          <BookingTable rows={affected} actions={(b) => (
            <>
              <button className="btn small" onClick={() => setRelocating(b)}>Choose a new room</button>{' '}
              <button className="btn small danger" onClick={() => cancel(b)}>Cancel</button>
            </>
          )} />
        </div>
      )}

      <div className="tabs" role="tablist">
        {Object.entries(tabs).map(([key, rows]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {key[0].toUpperCase() + key.slice(1)} ({rows.length})
          </button>
        ))}
      </div>

      {tabs[tab].length === 0
        ? <div className="empty">Nothing here yet. Find a room to make a booking.</div>
        : <BookingTable rows={tabs[tab]} actions={(b) =>
            tab === 'upcoming' && <button className="btn small danger" onClick={() => cancel(b)}>Cancel</button>} />}

      {relocating && (
        <RelocateModal booking={relocating} onClose={() => setRelocating(null)}
          onDone={() => { setRelocating(null); setNotice('Your booking is confirmed in the new room.'); load(); }} />
      )}
    </>
  );
}

function BookingTable({ rows, actions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Room</th><th>When</th><th>Purpose</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>{b.room.name}</td>
              <td>{fmtRange(b.startTime, b.endTime)}</td>
              <td>{b.purpose}<br /><small>{b.classStrength} students</small>{b.reviewNote && <><br /><small>Note: {b.reviewNote}</small></>}</td>
              <td><StatusBadge status={b.status} /></td>
              <td>{actions(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelocateModal({ booking, onClose, onDone }) {
  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/bookings/${booking.id}/alternatives`)
      .then((res) => setOptions(res.data.alternatives))
      .catch((err) => setError(errMsg(err)));
  }, [booking.id]);

  const pick = async (roomId) => {
    try {
      await api.patch(`/bookings/${booking.id}`, { roomId });
      onDone();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <Modal title="Choose a new room" onClose={onClose}>
      <p className="muted">{fmtRange(booking.startTime, booking.endTime)}, {booking.classStrength} students</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {options === null && !error && <p>Looking for free rooms...</p>}
      {options?.length === 0 && <p>No room with enough seats is free at this time. Cancel this booking and search for another slot.</p>}
      <div className="room-list">
        {options?.map((r) => (
          <div key={r.id} className="room-row">
            <div><h3>{r.name}</h3><div className="room-meta"><span>{r.capacity} seats</span>{r.building && <span>{r.building}</span>}</div></div>
            <button className="btn" onClick={() => pick(r.id)}>Use this room</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
