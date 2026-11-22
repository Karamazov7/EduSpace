import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { errMsg, fmt, label } from '../utils/format.js';

const ROLES = ['STUDENT', 'CLASS_REPRESENTATIVE', 'FACULTY', 'ADMIN', 'LAB_INCHARGE', 'HOD', 'TIMETABLE_COORDINATOR', 'MAINTENANCE_STAFF', 'MANAGEMENT'];

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [requests, setRequests] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [issued, setIssued] = useState(null); // { link, expiresAt, user }

  const load = useCallback(async (query = '') => {
    try {
      const [u, r] = await Promise.all([
        api.get('/users', { params: query ? { q: query } : {} }),
        api.get('/users/reset-requests'),
      ]);
      setUsers(u.data.users);
      setRequests(r.data.requests);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (u, changes, successText) => {
    setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/users/${u.id}`, changes);
      setUsers((list) => list.map((x) => (x.id === u.id ? data.user : x)));
      if (successText) setNotice(successText);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const createLink = async (userId) => {
    setError(''); setNotice('');
    try {
      const { data } = await api.post(`/users/${userId}/reset-link`);
      setIssued(data);
      load(q);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const closeRequest = async (id) => {
    setError('');
    try {
      await api.post(`/users/reset-requests/${id}/close`);
      load(q);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Users and roles</h1>
        <form className="actions" onSubmit={(e) => { e.preventDefault(); load(q); }}>
          <input aria-label="Search users" placeholder="Name, email or college ID" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">Search</button>
        </form>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}

      {requests.length > 0 && (
        <div className="alert info">
          <strong>{requests.length} password reset request{requests.length > 1 ? 's' : ''} waiting</strong>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>College ID</th><th>Asked</th><th></th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user.name}<br /><small>{r.user.email}</small></td>
                    <td>{r.user.collegeId}</td>
                    <td>{fmt(r.createdAt)}</td>
                    <td className="actions">
                      <button className="btn small" onClick={() => createLink(r.user.id)}>Create reset link</button>
                      <button className="btn small ghost" onClick={() => closeRequest(r.id)}>Dismiss</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="muted">
        Set a department for every HOD and every student or faculty member. A HOD only sees booking requests from their own department.
      </p>
      {users?.length === 0 && <div className="empty">No users match this search.</div>}
      {users?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>College ID</th><th>Department</th><th>Role</th><th>Active</th><th>Password</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}<br /><small>{u.email}</small></td>
                  <td>{u.collegeId}</td>
                  <td>
                    <DepartmentCell
                      user={u}
                      onSave={(department) => update(u, { department }, `Department updated for ${u.name}.`)}
                    />
                  </td>
                  <td>
                    <select aria-label={`Role for ${u.name}`} value={u.role} disabled={u.id === me.id}
                      onChange={(e) => update(u, { role: e.target.value }, `${u.name} is now ${label(e.target.value)}. They should refresh the page.`)}>
                      {ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" aria-label={`${u.name} is active`} checked={u.isActive} disabled={u.id === me.id}
                      onChange={(e) => update(u, { isActive: e.target.checked })} style={{ width: 'auto' }} />
                  </td>
                  <td>
                    <button className="btn small ghost" disabled={!u.isActive || u.id === me.id} onClick={() => createLink(u.id)}>
                      Reset link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {issued && <LinkModal data={issued} onClose={() => setIssued(null)} />}
    </>
  );
}

function LinkModal({ data, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal title="Password reset link" onClose={onClose}>
      <p>Give this link to <strong>{data.user.name}</strong> ({data.user.email}). It works once and expires on {fmt(data.expiresAt)}.</p>
      <div className="field">
        <label htmlFor="rl">Reset link</label>
        <textarea id="rl" readOnly value={data.link} onFocus={(e) => e.target.select()} style={{ minHeight: 90 }} />
      </div>
      <div className="alert info">This link is shown only now. Closing this window means creating a new one. Send it to the person directly, not in a group chat, because anyone with the link can set the password.</div>
      <div className="actions">
        <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

function DepartmentCell({ user, onSave }) {
  const [value, setValue] = useState(user.department || '');
  const changed = value.trim().toUpperCase() !== (user.department || '');

  return (
    <form className="actions" onSubmit={(e) => { e.preventDefault(); onSave(value.trim() || null); }}>
      <input
        aria-label={`Department for ${user.name}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. CSE"
        style={{ width: '7rem' }}
      />
      <button className="btn small ghost" disabled={!changed}>Save</button>
      {!user.department && <StatusBadge status="PENDING" text="Missing" />}
    </form>
  );
}
