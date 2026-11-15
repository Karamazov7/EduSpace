import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useRefreshOnChange } from '../api/socket.js';
import { errMsg, fmt } from '../utils/format.js';

export default function Notifications() {
  const [mine, setMine] = useState(null);
  const [campus, setCampus] = useState(null);
  const [tab, setTab] = useState('campus');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([api.get('/notifications/mine'), api.get('/notifications/campus')]);
      setMine(a.data.notifications);
      setCampus(b.data.broadcasts);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnChange(load); // new updates appear without reloading the page

  const tabs = [
    { key: 'campus', text: 'Campus updates', rows: campus },
    { key: 'mine', text: 'For you', rows: mine },
  ];
  const rows = tabs.find((t) => t.key === tab).rows;

  return (
    <>
      <div className="page-head"><h1>Notifications</h1></div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.text}{t.rows ? ` (${t.rows.length})` : ''}
          </button>
        ))}
      </div>
      <p className="muted">
        {tab === 'campus'
          ? 'Rooms being booked, freed up or closed for maintenance. Everyone sees the same updates from the last 30 days.'
          : 'Messages about your own bookings and requests.'}
      </p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {rows?.length === 0 && (
        <div className="empty">{tab === 'campus' ? 'No campus updates yet.' : 'Nothing for you yet. Updates about your bookings will show up here.'}</div>
      )}
      {rows?.map((n) => (
        <div className="panel" key={n.id}>
          <strong>{n.subject}</strong>
          <p style={{ margin: '.25rem 0' }}>{n.message}</p>
          <small>{fmt(n.createdAt)}</small>
        </div>
      ))}
    </>
  );
}
