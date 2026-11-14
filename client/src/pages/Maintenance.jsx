import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { errMsg, fmt, fieldErrors } from '../utils/format.js';

export default function Maintenance() {
  const [rooms, setRooms] = useState([]);
  const [blocks, setBlocks] = useState(null);
  const [form, setForm] = useState({ roomId: '', reason: '', startDate: '', endDate: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [notice, setNotice] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([api.get('/rooms'), api.get('/maintenance')]);
      setRooms(r.data.rooms);
      setBlocks(b.data.blocks);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setDetails([]); setNotice('');
    try {
      const { data } = await api.post('/maintenance', {
        roomId: Number(form.roomId),
        reason: form.reason,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      setNotice(
        data.affectedCount > 0
          ? `Room blocked. ${data.affectedCount} booking${data.affectedCount > 1 ? 's were' : ' was'} affected, and the users have been notified to pick another room.`
          : 'Room blocked. No existing bookings were affected.'
      );
      setForm({ roomId: '', reason: '', startDate: '', endDate: '' });
      load();
    } catch (err) {
      setError(errMsg(err));
      setDetails(fieldErrors(err));
    }
  };

  const complete = async (b) => {
    setError(''); setNotice('');
    try {
      await api.patch(`/maintenance/${b.id}/complete`);
      setNotice(`${b.room.name} is available for booking again.`);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className="page-head"><h1>Maintenance</h1></div>
      {error && <div className="alert error" role="alert">{error}{details.length > 0 && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      <form className="panel" onSubmit={submit}>
        <h2>Block a room</h2>
        <div className="form-grid">
          <div className="field"><label htmlFor="mr">Room</label>
            <select id="mr" value={form.roomId} onChange={set('roomId')} required>
              <option value="">Choose a room</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select></div>
          <div className="field"><label htmlFor="ms">From</label><input id="ms" type="datetime-local" value={form.startDate} onChange={set('startDate')} required /></div>
          <div className="field"><label htmlFor="me">Until</label><input id="me" type="datetime-local" value={form.endDate} onChange={set('endDate')} required /></div>
        </div>
        <div className="field" style={{ marginTop: '.75rem' }}><label htmlFor="mx">Reason</label>
          <input id="mx" value={form.reason} onChange={set('reason')} required minLength={3} placeholder="e.g. Projector repair" /></div>
        <button className="btn">Block room</button>
      </form>

      <h2>Maintenance records</h2>
      {blocks?.length === 0 && <div className="empty">No maintenance has been recorded.</div>}
      {blocks?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Room</th><th>Reason</th><th>Planned period</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td>{b.room.name}</td>
                  <td>{b.reason}<br /><small>By {b.createdBy.name}</small></td>
                  <td>{fmt(b.startDate)}<br />to {fmt(b.endDate)}</td>
                  <td>{b.completedAt ? <StatusBadge status="CONFIRMED" text={`Completed ${fmt(b.completedAt)}`} /> : <StatusBadge status="PENDING" text="Room blocked" />}</td>
                  <td>{!b.completedAt && <button className="btn small" onClick={() => complete(b)}>Mark room available</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
