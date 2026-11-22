import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios.js';
import { errMsg, fieldErrors } from '../utils/format.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="auth">
        <h1>Reset link missing</h1>
        <p>This page needs the link an administrator gave you. <Link to="/forgot-password">Ask for a new link</Link>.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth">
        <h1>Password changed</h1>
        <p>You can now <Link to="/login">log in</Link> with your new password.</p>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setDetails([]);
    if (password !== again) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setError(errMsg(err));
      setDetails(fieldErrors(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>Choose a new password</h1>
      <form className="panel" onSubmit={submit}>
        {error && (
          <div className="alert error" role="alert">
            {error}
            {details.length > 0 && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}
            {error.includes('invalid or has expired') && <p style={{ margin: '.5rem 0 0' }}><Link to="/forgot-password">Request a new link</Link></p>}
          </div>
        )}
        <div className="field"><label htmlFor="pw">New password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          <small>At least 8 characters, with a letter and a number.</small></div>
        <div className="field"><label htmlFor="pw2">Type it again</label>
          <input id="pw2" type="password" value={again} onChange={(e) => setAgain(e.target.value)} required autoComplete="new-password" /></div>
        <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
      </form>
    </div>
  );
}
