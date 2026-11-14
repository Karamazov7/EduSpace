import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Search from './pages/Search.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Notifications from './pages/Notifications.jsx';
import Approvals from './pages/Approvals.jsx';
import Rooms from './pages/Rooms.jsx';
import Maintenance from './pages/Maintenance.jsx';
import Users from './pages/Users.jsx';
import Reports from './pages/Reports.jsx';

const only = (roles, element) => <ProtectedRoute roles={roles}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Search />} />
        <Route path="bookings" element={<MyBookings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="approvals" element={only(['HOD', 'ADMIN'], <Approvals />)} />
        <Route path="rooms" element={only(['ADMIN', 'LAB_INCHARGE', 'MAINTENANCE_STAFF'], <Rooms />)} />
        <Route path="maintenance" element={only(['ADMIN', 'LAB_INCHARGE', 'MAINTENANCE_STAFF'], <Maintenance />)} />
        <Route path="users" element={only(['ADMIN'], <Users />)} />
        <Route path="reports" element={only(['ADMIN', 'HOD', 'MANAGEMENT'], <Reports />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
