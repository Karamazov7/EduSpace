import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useRefreshOnChange } from '../api/socket.js';
import { errMsg, fmt, fmtRange } from '../utils/format.js';

export default function Approvals() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings/pending');
      setRows(data.bookings);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnChange(load);

  const decide = async (b, action) => {
    setError(''); setNotice('');
    let note;
    if (action === 'reject') {
      note = window.prompt('Reason for rejecting (optional)');
      if (note === null) return;
    }
    try {
      await api.patch(`/bookings/${b.id}/${action}`, note ? { note } : {});
      setNotice(`Request ${action === 'approve' ? 'approved' : 'rejected'}. The requester has been notified.`);
      load();
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className="page-head"><h1>Booking requests</h1></div>
      <p className="muted">Oldest requests come first. Approving re-checks the room, so a clash is caught even if the slot was taken meanwhile.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}
      {rows && rows.length === 0 && <div className="empty">No requests are waiting for review.</div>}
      {rows?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Requested by</th><th>Room and time</th><th>Purpose</th><th>Sent</th><th></th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.user.name}<br /><small>{b.user.collegeId}{b.user.department ? `, ${b.user.department}` : ''}</small></td>
                  <td><strong>{b.room.name}</strong><br />{fmtRange(b.startTime, b.endTime)}</td>
                  <td>{b.purpose}<br /><small>{b.classStrength} students</small></td>
                  <td>{fmt(b.createdAt)}</td>
                  <td className="actions">
                    <button className="btn small" onClick={() => decide(b, 'approve')}>Approve</button>
                    <button className="btn small danger" onClick={() => decide(b, 'reject')}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
