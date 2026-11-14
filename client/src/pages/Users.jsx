import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { errMsg, label } from '../utils/format.js';

const ROLES = ['STUDENT', 'FACULTY', 'ADMIN', 'LAB_INCHARGE', 'HOD', 'TIMETABLE_COORDINATOR', 'MAINTENANCE_STAFF', 'MANAGEMENT'];

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (query = '') => {
    try {
      const { data } = await api.get('/users', { params: query ? { q: query } : {} });
      setUsers(data.users);
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

  return (
    <>
      <div className="page-head">
        <h1>Users and roles</h1>
        <form className="actions" onSubmit={(e) => { e.preventDefault(); load(q); }}>
          <input aria-label="Search users" placeholder="Name, email or college ID" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">Search</button>
        </form>
      </div>
      <p className="muted">
        Set a department for every HOD and every student or faculty member. A HOD only sees booking requests from their own department.
      </p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}
      {users?.length === 0 && <div className="empty">No users match this search.</div>}
      {users?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>College ID</th><th>Department</th><th>Role</th><th>Active</th></tr></thead>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
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