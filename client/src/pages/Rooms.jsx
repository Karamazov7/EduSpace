import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import Modal from '../components/Modal.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { errMsg, fieldErrors, label } from '../utils/format.js';

export default function Rooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // room object, or {} for new
  const [equipmentFor, setEquipmentFor] = useState(null);
  const canAdd = ['ADMIN', 'LAB_INCHARGE'].includes(user.role);
  // Admins manage every room. A lab in-charge manages only labs owned by their own department.
  const canTouch = (room) =>
    user.role === 'ADMIN' ||
    (user.role === 'LAB_INCHARGE' && room.type === 'LAB' && Boolean(user.department) && room.department === user.department);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/rooms', { params: { includeInactive: true } });
      setRooms(data.rooms);
    } catch (err) {
      setError(errMsg(err));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setError('');
    try { await fn(); load(); } catch (err) { setError(errMsg(err)); }
  };

  const toggleStatus = (r) => act(() =>
    api.patch(`/rooms/${r.id}/status`, { status: r.status === 'OPERATIONAL' ? 'NON_OPERATIONAL' : 'OPERATIONAL' }));
  const toggleActive = (r) => act(() =>
    r.isActive ? api.delete(`/rooms/${r.id}`) : api.put(`/rooms/${r.id}`, { isActive: true }));

  return (
    <>
      <div className="page-head">
        <h1>Rooms and labs</h1>
        {canAdd && <button className="btn" onClick={() => setEditing({})}>Add room</button>}
      </div>
      {user.role === 'ADMIN' && rooms?.some((r) => !r.department) && (
        <div className="alert info">
          Rooms with no department are treated as shared. Set the owning department on each lab so its own department can approve bookings for it.
        </div>
      )}
      {user.role === 'LAB_INCHARGE' && !user.department && (
        <div className="alert error">Your account has no department yet, so you cannot manage labs. Ask an admin to set it.</div>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}
      {rooms && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Department</th><th>Seats</th><th>Facilities</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} style={r.isActive ? undefined : { opacity: 0.6 }}>
                  <td><strong>{r.name}</strong><br /><small>{r.building}</small></td>
                  <td>{label(r.type)}</td>
                  <td>{r.department || <span className="muted">Shared</span>}</td>
                  <td>{r.capacity}</td>
                  <td>{r.facilities.join(', ') || '-'}</td>
                  <td>
                    <StatusBadge status={r.status} />{' '}
                    {!r.isActive && <StatusBadge status="CANCELLED" text="Deactivated" />}
                  </td>
                  <td className="actions">
                    {canTouch(r) && <button className="btn small ghost" onClick={() => setEditing(r)}>Edit</button>}
                    {canTouch(r) && r.type === 'LAB' && <button className="btn small ghost" onClick={() => setEquipmentFor(r)}>Equipment</button>}
                    {(canTouch(r) || user.role === 'MAINTENANCE_STAFF') && r.isActive && (
                      <button className="btn small ghost" onClick={() => toggleStatus(r)}>
                        {r.status === 'OPERATIONAL' ? 'Mark non-operational' : 'Mark operational'}
                      </button>
                    )}
                    {canTouch(r) && (
                      <button className="btn small danger" onClick={() => toggleActive(r)}>{r.isActive ? 'Deactivate' : 'Reactivate'}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <RoomForm room={editing} user={user} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {equipmentFor && <EquipmentModal room={equipmentFor} onClose={() => { setEquipmentFor(null); load(); }} />}
    </>
  );
}

function RoomForm({ room, user, onClose, onSaved }) {
  const isNew = !room.id;
  const isLabIncharge = user.role === 'LAB_INCHARGE';
  const [form, setForm] = useState({
    name: room.name || '',
    type: room.type || (isLabIncharge ? 'LAB' : 'CLASSROOM'),
    capacity: room.capacity || '',
    building: room.building || '',
    department: isLabIncharge ? user.department || '' : room.department || '',
    facilities: (room.facilities || []).join(', '),
  });
  const [error, setError] = useState('');
  const [details, setDetails] = useState([]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setDetails([]);
    const body = {
      ...form,
      capacity: Number(form.capacity),
      department: form.department.trim() || null,
      facilities: form.facilities.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (isNew) await api.post('/rooms', body);
      else await api.put(`/rooms/${room.id}`, body);
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setDetails(fieldErrors(err));
    }
  };

  return (
    <Modal title={isNew ? 'Add room' : `Edit ${room.name}`} onClose={onClose}>
      {error && <div className="alert error" role="alert">{error}{details.length > 0 && <ul>{details.map((d) => <li key={d}>{d}</li>)}</ul>}</div>}
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="rn">Name</label><input id="rn" value={form.name} onChange={set('name')} required /></div>
        <div className="field"><label htmlFor="rt">Type</label>
          <select id="rt" value={form.type} onChange={set('type')} disabled={isLabIncharge}>
            <option value="CLASSROOM">Classroom</option><option value="LAB">Lab</option>
          </select></div>
        <div className="field"><label htmlFor="rd">Owning department</label>
          <input id="rd" value={form.department} onChange={set('department')} placeholder="e.g. CSE" readOnly={isLabIncharge} />
          <small>{isLabIncharge ? 'New labs belong to your department.' : 'Leave empty for a shared room such as a central lecture hall.'}</small></div>
        <div className="field"><label htmlFor="rc">Seats</label><input id="rc" type="number" min="1" value={form.capacity} onChange={set('capacity')} required /></div>
        <div className="field"><label htmlFor="rb">Building</label><input id="rb" value={form.building} onChange={set('building')} /></div>
        <div className="field"><label htmlFor="rf">Facilities</label><input id="rf" value={form.facilities} onChange={set('facilities')} placeholder="Projector, Whiteboard" />
          <small>Separate with commas.</small></div>
        <button className="btn">Save room</button>
      </form>
    </Modal>
  );
}

function EquipmentModal({ room, onClose }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/rooms/${room.id}`);
      setItems(data.room.equipment);
    } catch (err) {
      setError(errMsg(err));
    }
  }, [room.id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setError('');
    try { await fn(); load(); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <Modal title={`Equipment in ${room.name}`} onClose={onClose} wide>
      {error && <div className="alert error" role="alert">{error}</div>}
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.post(`/rooms/${room.id}/equipment`, { name, quantity: Number(quantity) }); setName(''); setQuantity(1); }); }}>
        <div className="field"><label htmlFor="en">Equipment name</label><input id="en" value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="field"><label htmlFor="eq">Quantity</label><input id="eq" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        <button className="btn">Add equipment</button>
      </form>
      {items?.length === 0 && <p className="muted" style={{ marginTop: '1rem' }}>No equipment recorded for this lab yet.</p>}
      {items?.length > 0 && (
        <table style={{ marginTop: '1rem' }}>
          <thead><tr><th>Name</th><th>Quantity</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.quantity}</td><td><StatusBadge status={i.status} /></td>
                <td className="actions">
                  <button className="btn small ghost" onClick={() => act(() => api.put(`/rooms/equipment/${i.id}`, { status: i.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE' }))}>
                    Mark {i.status === 'AVAILABLE' ? 'unavailable' : 'available'}
                  </button>
                  <button className="btn small danger" onClick={() => act(() => api.delete(`/rooms/equipment/${i.id}`))}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
