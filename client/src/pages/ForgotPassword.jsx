import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { errMsg, fieldErrors } from '../utils/format.js';

export default function ForgotPassword() {
  const [form, setForm] = useState({ email: '', collegeId: '' });
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setDetails([]); setBusy(true);
    try {
      await api.post('/auth/forgot-password', form);
      setSent(true);
    } catch (err) {
      setError(errMsg(err));
      setDetails(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="auth">
        <h1>Request sent</h1>
        <p>If those details match an account, an administrator has been asked to send you a reset link.</p>
        <p className="muted">
          Contact your administrator to receive it. The link works once and expires after 24 hours. Open it, choose a new password, then log in.
        </p>
        <p><Link to="/login">Back to log in</Link></p>
      </div>
    );
  }

  return (
    <div className="auth">
      <h1>Forgot your password?</h1>
      <p className="muted">Enter the email and college ID of your account. An administrator will send you a link to choose a new password.</p>
      <form className="panel" onSubmit={submit}>
        {error && (
          <div className="alert error" role="alert">
            {error}
            {details.length > 0 && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}
          </div>
        )}
        <div className="field"><label htmlFor="email">Institute email</label>
          <input id="email" type="email" value={form.email} onChange={set('email')} required autoComplete="username" /></div>
        <div className="field"><label htmlFor="collegeId">College ID</label>
          <input id="collegeId" value={form.collegeId} onChange={set('collegeId')} required /></div>
        <button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Request a reset link'}</button>
      </form>
      <p><Link to="/login">Back to log in</Link></p>
    </div>
  );
}
