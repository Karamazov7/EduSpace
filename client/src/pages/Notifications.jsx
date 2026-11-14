import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import { errMsg, fmt } from '../utils/format.js';

export default function Notifications() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/notifications/mine')
      .then((res) => setItems(res.data.notifications))
      .catch((err) => setError(errMsg(err)));
  }, []);

  return (
    <>
      <div className="page-head"><h1>Notifications</h1></div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {items?.length === 0 && <div className="empty">No notifications yet. Booking updates will show up here.</div>}
      {items?.map((n) => (
        <div className="panel" key={n.id}>
          <strong>{n.subject}</strong>
          <p style={{ margin: '.25rem 0' }}>{n.message}</p>
          <small>{fmt(n.createdAt)}</small>
        </div>
      ))}
    </>
  );
}
