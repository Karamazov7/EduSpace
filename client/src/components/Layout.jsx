import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { label } from "../utils/format.js";

const LINKS = [
  { to: "/", text: "Find a room", end: true },
  { to: "/bookings", text: "My bookings" },
  { to: "/approvals", text: "Approvals", roles: ["HOD", "ADMIN"] },
  {
    to: "/rooms",
    text: "Rooms",
    roles: ["ADMIN", "LAB_INCHARGE", "MAINTENANCE_STAFF"],
  },
  {
    to: "/maintenance",
    text: "Maintenance",
    roles: ["ADMIN", "LAB_INCHARGE", "MAINTENANCE_STAFF"],
  },
  { to: "/users", text: "Users", roles: ["ADMIN"] },
  { to: "/reports", text: "Reports", roles: ["ADMIN", "HOD", "MANAGEMENT"] },
  { to: "/notifications", text: "Notifications" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = LINKS.filter((l) => !l.roles || l.roles.includes(user.role));

  return (
    <>
      <header className="topbar">
        <div className="brand">
          EduSpace<span>NIT Calicut</span>
        </div>
        <nav aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.text}
            </NavLink>
          ))}
        </nav>
        <div className="who">
          <div>
            <strong>{user.name}</strong>
            <small>{label(user.role)}</small>
          </div>
          <button
            className="btn ghost"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
