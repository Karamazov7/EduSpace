import { useCallback, useState } from 'react';
import api from '../api/axios.js';
import { useRefreshOnChange } from '../api/socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { errMsg, fmtRange, label, todayStr, toISO } from '../utils/format.js';

export default function Search() {
  const [form, setForm] = useState({ date: todayStr(), startTime: '09:00', endTime: '10:00', type: '', capacity: '' });
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const slot = () => ({ start: toISO(form.date, form.startTime), end: toISO(form.date, form.endTime) });

  const search = useCallback(async () => {
    setError('');
    if (form.endTime <= form.startTime) return setError('End time must be after start time.');
    try {
      const params = { ...slot() };
      if (form.type) params.type = form.type;
      if (form.capacity) params.capacity = form.capacity;
      const { data } = await api.get('/rooms/search', { params });
      setRooms(data.rooms);
    } catch (err) {
      setError(errMsg(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  useRefreshOnChange(() => { if (rooms) search(); });

  const onSubmit = (e) => { e.preventDefault(); setNotice(''); search(); };
  const available = rooms ? rooms.filter((r) => r.available) : [];
  const unavailable = rooms ? rooms.filter((r) => !r.available) : [];

  return (
    <>
      <div className="page-head"><h1>Find a room</h1></div>
      <form className="panel form-grid" onSubmit={onSubmit}>
        <div className="field"><label htmlFor="date">Date</label>
          <input id="date" type="date" min={todayStr()} value={form.date} onChange={set('date')} required /></div>
        <div className="field"><label htmlFor="st">Start time</label>
          <input id="st" type="time" value={form.startTime} onChange={set('startTime')} required /></div>
        <div className="field"><label htmlFor="et">End time</label>
          <input id="et" type="time" value={form.endTime} onChange={set('endTime')} required /></div>
        <div className="field"><label htmlFor="type">Room type</label>
          <select id="type" value={form.type} onChange={set('type')}>
            <option value="">Classroom or lab</option>
            <option value="CLASSROOM">Classroom</option>
            <option value="LAB">Lab</option>
          </select></div>
        <div className="field"><label htmlFor="cap">Seats needed</label>
          <input id="cap" type="number" min="1" value={form.capacity} onChange={set('capacity')} placeholder="Any" /></div>
        <button className="btn">Search rooms</button>
      </form>

      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {rooms && rooms.length === 0 && (
        <div className="empty">No rooms match these filters. Try fewer seats or a different room type.</div>
      )}

      {available.length > 0 && (
        <>
          <h2>Available ({available.length})</h2>
          <div className="room-list">
            {available.map((r) => <RoomRow key={r.id} room={r} onBook={() => setSelected(r)} />)}
          </div>
        </>
      )}
      {unavailable.length > 0 && (
        <>
          <h2 style={{ marginTop: '1.5rem' }}>Not available ({unavailable.length})</h2>
          <div className="room-list">
            {unavailable.map((r) => <RoomRow key={r.id} room={r} />)}
          </div>
        </>
      )}

      {selected && (
        <BookingModal
          room={selected}
          form={form}
          slot={slot()}
          onClose={() => setSelected(null)}
          onBooked={(b) => {
            setSelected(null);
            setNotice(
              b.status === 'CONFIRMED'
                ? `Booked ${b.room.name}, ${fmtRange(b.startTime, b.endTime)}. A confirmation email is on its way.`
                : `Request sent for ${b.room.name}, ${fmtRange(b.startTime, b.endTime)}. You will be notified when your HOD or an admin decides.`
            );
            search();
          }}
        />
      )}
    </>
  );
}

function RoomRow({ room, onBook }) {
  const faulty = room.equipment.filter((e) => e.status === 'UNAVAILABLE').length;
  return (
    <div className={`room-row${room.available ? '' : ' unavailable'}`}>
      <div>
        <h3>{room.name} <StatusBadge status={room.available ? 'AVAILABLE' : 'UNAVAILABLE'} text={room.available ? 'Available' : room.reasonText} /></h3>
        <div className="room-meta">
          <span>{label(room.type)}</span>
          <span>{room.capacity} seats</span>
          {room.building && <span>{room.building}</span>}
          {room.facilities.length > 0 && <span>{room.facilities.join(', ')}</span>}
          {room.equipment.length > 0 && (
            <span>{room.equipment.length} equipment types{faulty > 0 ? `, ${faulty} unavailable` : ''}</span>
          )}
        </div>
      </div>
      {onBook && <button className="btn" onClick={onBook}>Book</button>}
    </div>
  );
}

function BookingModal({ room, form, slot, onClose, onBooked }) {
  const { user } = useAuth();
  const [classStrength, setClassStrength] = useState(form.capacity || '');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [alternatives, setAlternatives] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (roomId) => {
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/bookings', { roomId, classStrength, purpose, ...slot });
      onBooked(data.booking);
    } catch (err) {
      setError(errMsg(err));
      setAlternatives(err.response?.status === 409 ? err.response.data.details?.alternatives || [] : null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Book ${room.name}`} onClose={onClose}>
      <p className="muted">{fmtRange(slot.start, slot.end)}</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      <form onSubmit={(e) => { e.preventDefault(); submit(room.id); }}>
        <div className="field"><label>College ID</label><input value={user.collegeId} readOnly /></div>
        <div className="field"><label htmlFor="cs">Class strength</label>
          <input id="cs" type="number" min="1" max={room.capacity} value={classStrength} onChange={(e) => setClassStrength(e.target.value)} required />
          <small>{room.name} seats {room.capacity}.</small></div>
        <div className="field"><label htmlFor="pu">Purpose</label>
          <textarea id="pu" value={purpose} onChange={(e) => setPurpose(e.target.value)} required minLength={3} placeholder="e.g. Extra class for CS3001" /></div>
        <div className="actions">
          <button className="btn" disabled={busy}>{busy ? 'Booking...' : 'Confirm booking'}</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>

      {alternatives && (
        <div style={{ marginTop: '1rem' }}>
          <h2>Other rooms for this time</h2>
          {alternatives.length === 0 && <p className="muted">No other room is free with enough seats. Try a different time.</p>}
          <div className="room-list">
            {alternatives.map((a) => (
              <div key={a.id} className="room-row">
                <div><h3>{a.name}</h3><div className="room-meta"><span>{a.capacity} seats</span>{a.building && <span>{a.building}</span>}</div></div>
                <button className="btn" disabled={busy} onClick={() => submit(a.id)}>Book this room</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
