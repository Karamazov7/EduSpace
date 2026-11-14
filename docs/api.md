# API reference

Base path: `/api`. Requests and responses are JSON.

## Conventions

- Send the login token as `Authorization: Bearer <token>`. Every endpoint needs it except register, login and health.
- Times are ISO 8601 in UTC, for example `2026-11-20T04:30:00.000Z`.
- Errors look like `{ "message": "..." }`. Validation errors add `"details": [{ "field": "...", "message": "..." }]`.

| Status | Meaning |
|---|---|
| 400 | Invalid input |
| 401 | Missing, invalid or expired token, or account deactivated |
| 403 | Your role is not allowed to do this |
| 404 | Not found |
| 409 | Conflict: duplicate, room not available, or wrong state |
| 422 | The room is too small for the class strength |

## Health

`GET /health` returns `{ "status": "ok", "dbTime": "..." }`.

## Auth

| Method and path | Body | Result |
|---|---|---|
| `POST /auth/register` | `collegeId`, `name`, `email` (must end in `@nitc.ac.in`), `password` (8 to 72 characters, with a letter and a number), `department` | `201` with the new user. Every new account is a student, and any `role` sent is ignored. The department is stored in capitals. |
| `POST /auth/login` | `email`, `password` | `{ token, user }` |
| `GET /auth/me` | none | `{ user }` |

## Rooms

| Method and path | Roles | Notes |
|---|---|---|
| `GET /rooms/search?start=&end=&type=&capacity=` | any | `type` is `CLASSROOM` or `LAB` (optional). Returns every active room that matches, with `available`, `reason` (`BOOKED`, `MAINTENANCE` or `NON_OPERATIONAL`) and `reasonText`. |
| `GET /rooms` | any | Active rooms with equipment. Admin, lab in-charge and maintenance staff can add `?includeInactive=true`. |
| `GET /rooms/:id` | any | One room with its equipment |
| `POST /rooms` | admin, lab in-charge (labs only) | `name`, `type`, `capacity`, and optionally `building`, `facilities` (a list), `status` |
| `PUT /rooms/:id` | admin, lab in-charge (labs only) | Any of the above, plus `isActive` |
| `DELETE /rooms/:id` | admin, lab in-charge (labs only) | Deactivates the room. History is kept. |
| `PATCH /rooms/:id/status` | admin, lab in-charge, maintenance staff | `{ "status": "OPERATIONAL" }` or `{ "status": "NON_OPERATIONAL" }` |
| `POST /rooms/:id/equipment` | admin, lab in-charge | `name`, optional `quantity` and `status` (`AVAILABLE` or `UNAVAILABLE`) |
| `PUT /rooms/equipment/:eid` | admin, lab in-charge | Any equipment field |
| `DELETE /rooms/equipment/:eid` | admin, lab in-charge | `204` |

## Bookings

| Method and path | Roles | Notes |
|---|---|---|
| `POST /bookings` | any | `roomId`, `classStrength`, `purpose`, `start`, `end`. Returns `201` with `{ booking }`. Status is `PENDING` for students and `CONFIRMED` for everyone else. |
| `GET /bookings/mine` | any | All of your bookings, newest first |
| `GET /bookings/pending` | HOD, admin | Requests waiting for review, oldest first. A HOD with a department sees only that department. |
| `GET /bookings/:id/alternatives` | owner, admin | Free rooms for the same time with enough seats |
| `PATCH /bookings/:id` | owner, admin | Change `roomId`, `start`, `end`, `classStrength` or `purpose`. Also used to confirm a replacement room after maintenance. |
| `PATCH /bookings/:id/cancel` | owner, admin | Not allowed once the booking has started (admins excepted) |
| `PATCH /bookings/:id/approve` | HOD, admin | Optional `{ "note": "..." }`. Re-checks the room first. |
| `PATCH /bookings/:id/reject` | HOD, admin | Optional `{ "note": "..." }` |

Booking statuses: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, and `AFFECTED` (the room was blocked for maintenance and the owner must pick another).

### Example: the room is taken

`POST /bookings` returns `409`:

```json
{
  "message": "Already booked for this time",
  "details": {
    "reason": "BOOKED",
    "alternatives": [
      { "id": 2, "name": "LH-102", "capacity": 60, "available": true }
    ]
  }
}
```

## Maintenance

Roles: admin, lab in-charge, maintenance staff.

| Method and path | Notes |
|---|---|
| `GET /maintenance` | Latest 100 records |
| `POST /maintenance` | `roomId`, `reason`, `startDate`, `endDate`. Blocks the room, marks overlapping bookings `AFFECTED` and notifies their owners. Returns `{ block, affectedCount }`. |
| `PATCH /maintenance/:id/complete` | Makes the room bookable again |

## Users (admin only)

| Method and path | Notes |
|---|---|
| `GET /users?q=` | Search by name, email or college ID (max 200 results) |
| `PATCH /users/:id` | `role`, `isActive`, `department` (send `null` to clear it). You cannot demote or deactivate yourself. |

## Notifications and reports

| Method and path | Roles | Notes |
|---|---|---|
| `GET /notifications/mine` | any | Your latest 50 notifications |
| `GET /reports/utilization?from=&to=` | admin, HOD, management | Totals, per-room hours and utilisation %, bookings by department and by status |

## Live updates

The server runs Socket.IO on the same address. It sends an `availability:changed` event (with no data) after any booking, room or maintenance change. The web app listens for it and refreshes.
