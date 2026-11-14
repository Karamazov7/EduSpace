import { useCallback, useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../api/axios.js';
import { errMsg, label, todayStr } from '../utils/format.js';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const PALETTE = ['#17624a', '#b7791f', '#2b6cb0', '#a3271f', '#6b46c1', '#4a5c56'];
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/reports/utilization', {
        params: { from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() },
      });
      setData(res.data);
    } catch (err) {
      setError(errMsg(err));
    }
  }, [from, to]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="page-head"><h1>Room utilisation</h1></div>
      <form className="panel form-grid" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <div className="field"><label htmlFor="rf">From</label><input id="rf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required /></div>
        <div className="field"><label htmlFor="rt">To</label><input id="rt" type="date" value={to} onChange={(e) => setTo(e.target.value)} required /></div>
        <button className="btn">Update report</button>
      </form>
      {error && <div className="alert error" role="alert">{error}</div>}

      {data && (
        <>
          <div className="stats">
            <div className="stat"><strong>{data.totals.confirmedBookings}</strong>Confirmed bookings</div>
            <div className="stat"><strong>{data.totals.bookedHours}</strong>Hours booked</div>
            <div className="stat"><strong>{data.totals.averageUtilizationPct}%</strong>Average room utilisation</div>
          </div>
          {data.totals.confirmedBookings === 0 && <div className="empty">No confirmed bookings in this period.</div>}
          <div className="charts">
            <div className="panel">
              <h2>Utilisation by room (%)</h2>
              <Bar
                data={{ labels: data.rooms.map((r) => r.name), datasets: [{ label: 'Utilisation %', data: data.rooms.map((r) => r.utilizationPct), backgroundColor: '#17624a' }] }}
                options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }}
              />
            </div>
            <div className="panel">
              <h2>Bookings by status</h2>
              <Doughnut
                data={{ labels: data.byStatus.map((s) => label(s.status)), datasets: [{ data: data.byStatus.map((s) => s.count), backgroundColor: PALETTE }] }}
              />
            </div>
            <div className="panel">
              <h2>Confirmed bookings by department</h2>
              <Bar
                data={{ labels: data.byDepartment.map((d) => d.department), datasets: [{ label: 'Bookings', data: data.byDepartment.map((d) => d.count), backgroundColor: '#2b6cb0' }] }}
                options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
