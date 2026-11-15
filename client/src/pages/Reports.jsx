import { useCallback, useEffect, useMemo, useState } from 'react';
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

// Writes the value at the end of each bar, so even a very short bar can be read.
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _args, opts) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 12px "IBM Plex Sans", sans-serif';
    ctx.fillStyle = '#172321';
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      ctx.fillText(opts.format(chart.data.datasets[0].data[i]), bar.x + 6, bar.y);
    });
    ctx.restore();
  },
};

const fmtHours = (h) => `${h} h`;
const fmtPct = (p) => (p > 0 && p < 0.1 ? '<0.1%' : `${p}%`);

export default function Reports() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState('hours'); // 'hours' or 'pct'
  const [onlyUsed, setOnlyUsed] = useState(false);

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

  // Busiest rooms first. The axis length follows the data, so a few short bookings still fill the chart.
  const room = useMemo(() => {
    if (!data) return null;
    const key = metric === 'hours' ? 'hours' : 'utilizationPct';
    const rows = data.rooms.filter((r) => !onlyUsed || r.bookings > 0).sort((a, b) => b[key] - a[key] || a.name.localeCompare(b.name));
    const top = Math.max(0, ...rows.map((r) => r[key]));
    const axisMax = metric === 'hours'
      ? Math.max(2, Math.ceil(top * 1.25))
      : Math.min(100, Math.max(2, Math.ceil(top * 1.25)));
    return { rows, key, axisMax, format: metric === 'hours' ? fmtHours : fmtPct };
  }, [data, metric, onlyUsed]);

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
            <div className="stat"><strong>{fmtPct(data.totals.averageUtilizationPct)}</strong>Average room utilisation</div>
          </div>
          {data.totals.confirmedBookings === 0 && <div className="empty">No confirmed bookings in this period.</div>}

          <div className="panel">
            <div className="page-head" style={{ marginBottom: '.5rem' }}>
              <h2 style={{ margin: 0 }}>{metric === 'hours' ? 'Hours booked by room' : 'Utilisation by room'}</h2>
              <div className="actions">
                <div className="tabs" role="tablist" style={{ margin: 0, border: 0 }}>
                  <button role="tab" aria-selected={metric === 'hours'} onClick={() => setMetric('hours')}>Hours</button>
                  <button role="tab" aria-selected={metric === 'pct'} onClick={() => setMetric('pct')}>Percent</button>
                </div>
                <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', fontSize: '.88rem' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} />
                  Only rooms with bookings
                </label>
              </div>
            </div>
            <p className="muted">
              {metric === 'pct'
                ? `Share of each room's open hours (${data.range.days} days, 8 AM to 8 PM) that were booked.`
                : 'Confirmed booking hours in the selected period.'} The axis adjusts to the busiest room.
            </p>
            {room.rows.length === 0 ? <div className="empty">No rooms to show.</div> : (
              <div style={{ position: 'relative', height: Math.max(200, room.rows.length * 34 + 70) }}>
                <Bar
                  plugins={[valueLabels]}
                  data={{
                    labels: room.rows.map((r) => r.name),
                    datasets: [{ data: room.rows.map((r) => r[room.key]), backgroundColor: '#17624a', borderRadius: 3, barThickness: 20, minBarLength: 3 }],
                  }}
                  options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    layout: { padding: { right: 56 } },
                    plugins: {
                      legend: { display: false },
                      valueLabels: { format: room.format },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const r = room.rows[ctx.dataIndex];
                            return `${r.hours} h booked (${fmtPct(r.utilizationPct)}), ${r.bookings} booking${r.bookings === 1 ? '' : 's'}`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: { beginAtZero: true, max: room.axisMax, ticks: { precision: 0 } },
                      y: { grid: { display: false } },
                    },
                  }}
                />
              </div>
            )}
          </div>

          <div className="charts">
            <div className="panel">
              <h2>Bookings by status</h2>
              <Doughnut
                data={{ labels: data.byStatus.map((s) => label(s.status)), datasets: [{ data: data.byStatus.map((s) => s.count), backgroundColor: PALETTE }] }}
              />
            </div>
            <div className="panel">
              <h2>Confirmed bookings by department</h2>
              <Bar
                data={{ labels: data.byDepartment.map((d) => d.department), datasets: [{ label: 'Bookings', data: data.byDepartment.map((d) => d.count), backgroundColor: '#2b6cb0', maxBarThickness: 48 }] }}
                options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
