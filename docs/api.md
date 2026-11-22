# API reference

Base path: `/api`. Requests and responses are JSON.

## Conventions

- Send the login token as `Authorization: Bearer <token>`. Every endpoint needs it except register, login, forgot-password, reset-password, health and config.
- Times are ISO 8601 in UTC, for example `2026-11-20T04:30:00.000Z`. Booking hours and the booking window are checked in Indian Standard Time.
- Errors look like `{ "message": "..." }`. Validation errors add `"details": [{ "field": "...", "message": "..." }]`.

| Status | Meaning |
|---|---|
| 400 | Invalid input, including times outside the booking rules |
| 401 | Missing, invalid or expired token, or account deactivated |
| 403 | Your role is not allowed to do this |
| 404 | Not found |
| 409 | Conflict: duplicate, room not available, or wrong state |
| 422 | The room is too small for the class strength |

## Booking rules (apply to search, booking and changing a booking)

- Start no earlier than **8:00 AM** and end no later than **8:00 PM**, on the same day.
- The date must be no later than **one month** from today.
- The start must not be in the past, and a booking cannot be longer than 12 hours.

`GET /config` returns the current rules so the pickers match the server:

```json
{ "booking": { "openTime": "08:00", "closeTime": "20:00", "latestDate": "2026-12-15", "timezone": "Asia/Kolkata" } }
```

## Health

`GET /health` returns `{ "status": "ok", "dbTime": "..." }`.

## Auth

| Method and path | Body | Result |
|---|---|---|
| `POST /auth/register` | `collegeId`, `name`, `email` (must end in `@nitc.ac.in`), `password` (8 to 72 characters, with a letter and a number), `department` (required, stored in capitals) | `201` with the new user. Every new account is a student, and any `role` sent is ignored. |
| `POST /auth/login` | `email`, `password` | `{ token, user }` |
| `GET /auth/me` | none | `{ user }` |
| `POST /auth/forgot-password` | `email`, `collegeId` | `200` with the same message every time, whether or not the details match an account. A request is recorded only when both match an active account. |
| `POST /auth/reset-password` | `token` (from the reset link), `password` (same rules as registration) | `200` when the password was changed. `400` if the link is invalid, expired or already used. |

## Rooms

A room has an optional `department` (the owning department). A room without one is shared.

| Method and path | Roles | Notes |
|---|---|---|
| `GET /rooms/search?start=&end=&type=&capacity=` | any | `type` is `CLASSROOM` or `LAB` (optional). Returns every active room that matches, with `available`, `reason` (`BOOKED`, `MAINTENANCE` or `NON_OPERATIONAL`) and `reasonText`. Refused with `400` outside the booking rules. |
| `GET /rooms` | any | Active rooms with equipment. Admin, lab in-charge and maintenance staff can add `?includeInactive=true`. |
| `GET /rooms/:id` | any | One room with its equipment |
| `POST /rooms` | admin, lab in-charge | `name`, `type`, `capacity`, optional `building`, `department`, `facilities` (a list), `status`. A lab in-charge can only create labs, and they always belong to the lab in-charge's department. |
| `PUT /rooms/:id` | admin, lab in-charge | Any of the above, plus `isActive`. A lab in-charge can edit only labs of their own department and cannot change the department. |
| `DELETE /rooms/:id` | admin, lab in-charge | Deactivates the room. History is kept. Same department limit. |
| `PATCH /rooms/:id/status` | admin, lab in-charge, maintenance staff | `{ "status": "OPERATIONAL" }` or `{ "status": "NON_OPERATIONAL" }` |
| `POST /rooms/:id/equipment` | admin, lab in-charge | `name`, optional `quantity` and `status` (`AVAILABLE` or `UNAVAILABLE`) |
| `PUT /rooms/equipment/:eid` | admin, lab in-charge | Any equipment field |
| `DELETE /rooms/equipment/:eid` | admin, lab in-charge | `204` |

## Bookings

| Method and path | Roles | Notes |
|---|---|---|
| `POST /bookings` | any | `roomId`, `classStrength`, `purpose`, `start`, `end`. Returns `201` with `{ booking }`. Status is `PENDING` for students and `CONFIRMED` for everyone else, including class representatives. |
| `GET /bookings/mine` | any | All of your bookings, newest first |
| `GET /bookings/pending` | HOD, faculty, lab in-charge, admin | Requests this person may review, oldest first (see the review rule below) |
| `GET /bookings/:id/alternatives` | owner, admin | Free rooms for the same time with enough seats |
| `PATCH /bookings/:id` | owner, admin | Change `roomId`, `start`, `end`, `classStrength` or `purpose`. Also used to confirm a replacement room after maintenance. |
| `PATCH /bookings/:id/cancel` | owner, admin | Not allowed once the booking has started (admins excepted) |
| `PATCH /bookings/:id/approve` | HOD, faculty, lab in-charge, admin | Optional `{ "note": "..." }`. Checks the room again. Cancels competing pending requests. |
| `PATCH /bookings/:id/reject` | HOD, faculty, lab in-charge, admin | Optional `{ "note": "..." }` |

Booking statuses: `PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`, and `AFFECTED` (the room was blocked for maintenance and the owner must pick another).

### Review rule

| Reviewer | May review a request when... |
|---|---|
| HOD or faculty | the student's department **or** the room's owning department is the reviewer's department |
| Lab in-charge | the room is a lab owned by the reviewer's department |
| Admin | always |

A room with no owning department counts as owned by the student's department. A reviewer without a department sees nothing. The rule is one setting (`REVIEW_BY`) in `bookingService.js`: `either` (default), `owner` or `requester`.

### Automatic cancellation

When a booking becomes `CONFIRMED` (approval, direct confirmation or a change), every other `PENDING` request for the same room with an overlapping time is set to `CANCELLED` with the note "Cancelled automatically: another booking for this room and time was approved." Those users get a notification.

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

## Users

### Admin

| Method and path | Notes |
|---|---|
| `GET /users?q=` | Search by name, email or college ID (max 200 results) |
| `PATCH /users/:id` | `role`, `isActive`, `department` (send `null` to clear it). You cannot demote or deactivate yourself. |
| `GET /users/reset-requests` | People who asked for a password reset and are waiting for a link, oldest first |
| `POST /users/:id/reset-link` | Creates a one-time reset link for an active account, with or without a request. Returns `{ link, expiresAt, user }`. The link is shown only in this response. Any older unused link for that person stops working. |
| `POST /users/reset-requests/:rid/close` | Dismisses a waiting request. `204`. |

### HOD and faculty (their own department only)

| Method and path | Notes |
|---|---|
| `GET /users/department?q=` | People in your department whose role you may change, plus `allowedRoles` |
| `PATCH /users/:id/role` | `{ "role": "STUDENT" \| "CLASS_REPRESENTATIVE" \| "FACULTY" }` |

| Who | May switch people between |
|---|---|
| HOD | student, class representative, faculty |
| Faculty | student, class representative |

Nobody can change their own role, someone in another department, or a person who holds any other role.

## Password reset (forgot password)

There is no email. An administrator hands the user a one-time link.

1. The user sends `POST /auth/forgot-password` with their email and college ID. The answer is always the same, so the form cannot be used to find out who has an account.
2. If both details match an active account, a request is recorded and administrators get a notification.
3. An administrator calls `POST /users/:id/reset-link` and gives the link to the person.
4. The user opens `<CLIENT_URL>/reset-password?token=...` and sends `POST /auth/reset-password`.

About the link:
- The token is 64 random characters. Only its SHA-256 hash is stored.
- It works once and expires after 24 hours. A newer link replaces an older one.
- After a successful reset, every login token issued before it is refused with `401` ("Your password was changed. Please log in again.").
- The user is notified that the password was changed.

## Notifications and reports

| Method and path | Roles | Notes |
|---|---|---|
| `GET /notifications/mine` | any | Your latest 50 personal notifications |
| `GET /notifications/campus` | any | Campus updates from the last 30 days (room booked, freed, closed for maintenance, reopened). Contains no names or purposes. |
| `GET /reports/utilization?from=&to=` | admin, HOD, management | Totals, per-room hours and utilisation %, bookings by department and by status. Utilisation = confirmed booked hours / (days in range x 12 open hours). |

## Live updates

The server runs Socket.IO on the same address. It sends an `availability:changed` event (with no data) after any booking, room or maintenance change. The web app listens for it and refreshes.
