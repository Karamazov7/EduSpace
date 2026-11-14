import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg, fieldErrors } from '../utils/format.js';

export default function Register() {
  const { user } = useAuth();
  const [form, setForm] = useState({ collegeId: '', name: '', email: '', password: '', department: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setDetails([]);
    setBusy(true);
    try {
      await api.post('/auth/register', form);
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
      setDetails(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth">
        <h1>Account created</h1>
        <p>You can now <Link to="/login">log in</Link> with your institute email.</p>
        <p className="muted">Faculty members: ask an administrator to update your role so your bookings are confirmed instantly.</p>
      </div>
    );
  }

  return (
    <div className="auth">
      <h1>Create an account</h1>
      <p className="muted">Use your @nitc.ac.in email address.</p>
      <form className="panel" onSubmit={submit}>
        {error && (
          <div className="alert error" role="alert">
            {error}
            {details.length > 0 && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        )}
        <div className="field"><label htmlFor="collegeId">College ID</label>
          <input id="collegeId" value={form.collegeId} onChange={set('collegeId')} required /></div>
        <div className="field"><label htmlFor="name">Full name</label>
          <input id="name" value={form.name} onChange={set('name')} required /></div>
        <div className="field"><label htmlFor="email">Institute email</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} required /></div>
        <div className="field"><label htmlFor="password">Password</label>
          <input id="password" type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
          <small>At least 8 characters, with a letter and a number.</small></div>
        <div className="field"><label htmlFor="department">Department</label>
          <input id="department" value={form.department} onChange={set('department')} required placeholder="e.g. CSE" />
          <small>Use your department's short code. Your HOD sees your booking requests by department.</small></div>
        <button className="btn" disabled={busy}>{busy ? 'Creating...' : 'Create account'}</button>
      </form>
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </div>
  );
}