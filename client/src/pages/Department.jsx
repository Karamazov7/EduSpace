import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg, label } from '../utils/format.js';

export default function Department() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState(null);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (query = '') => {
    try {
      const { data } = await api.get('/users/department', { params: query ? { q: query } : {} });
      setUsers(data.users);
      setAllowedRoles(data.allowedRoles);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (u, role) => {
    setError(''); setNotice('');
    try {
      const { data } = await api.patch(`/users/${u.id}/role`, { role });
      setUsers((list) => list.map((x) => (x.id === u.id ? data.user : x)));
      setNotice(`${u.name} is now ${label(role).toLowerCase()}. They should refresh the page.`);
    } catch (err) {
      setError(errMsg(err));
    }
  };

  const hint = me.role === 'HOD'
    ? 'As HOD you can make students faculty members or class representatives.'
    : 'As a faculty member you can make students class representatives. A class representative\'s bookings are confirmed without approval.';

  return (
    <>
      <div className="page-head">
        <h1>My department{me.department ? ` (${me.department})` : ''}</h1>
        <form className="actions" onSubmit={(e) => { e.preventDefault(); load(q); }}>
          <input aria-label="Search people" placeholder="Name, email or college ID" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn">Search</button>
        </form>
      </div>
      <p className="muted">{hint} You can only change people in your own department.</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}
      {users?.length === 0 && <div className="empty">No one in your department matches this search.</div>}
      {users?.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>College ID</th><th>Role</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}<br /><small>{u.email}</small></td>
                  <td>{u.collegeId}</td>
                  <td>
                    <select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                      {allowedRoles.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                    </select>
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
