# SRS traceability

Where each functional requirement of the [SRS](SRS.pdf) is implemented. Paths are relative to `server/src` or `client/src`, depending on the file type.

| ID | Requirement | Implemented in |
|---|---|---|
| FR-001 | Register or sign in with institution identity | `routes/authRoutes.js`, `services/authService.js` (nitc.ac.in check), `pages/Register.jsx`, `pages/Login.jsx` |
| FR-002 | Authenticate and manage JWT tokens | `authService.login`, `middleware/authenticate.js` |
| FR-003 | Store passwords as bcrypt hashes | `authService.js` (bcrypt, 12 rounds) |
| FR-004 | Role-based permissions | `middleware/authorize.js`, `components/ProtectedRoute.jsx`, `components/Layout.jsx` |
| FR-005 | Reject unauthenticated or unauthorised access | `authenticate.js`, `authorize.js` |
| FR-006 | Admin manages accounts and roles | `routes/userRoutes.js`, `pages/Users.jsx` (role, department, active) |
| FR-007 | Create, view, update, deactivate rooms and labs | `routes/roomRoutes.js`, `pages/Rooms.jsx` |
| FR-008 | Room record: identity, type, capacity, facilities, status | `prisma/schema.prisma` (Room) |
| FR-009 | Lab in-charge maintains equipment | Equipment endpoints in `roomRoutes.js`, equipment window in `Rooms.jsx` |
| FR-010 | Block unauthorised changes to rooms and equipment | `authorize(...)` plus `assertCanManage` in `roomRoutes.js` |
| FR-011 | Room status available to search and booking | `services/availabilityService.js` |
| FR-012 | Search by date, start and end time | `GET /rooms/search`, `pages/Search.jsx` |
| FR-013 | Show availability for the slot | `searchRooms` returns `available` and `reason` |
| FR-014 | Show capacity, facilities and known issues before selection | Room rows in `pages/Search.jsx` |
| FR-015 | Identify rooms with enough capacity | `capacity` filter in `searchRooms` |
| FR-016 | Exclude blocked and non-operational rooms from available results | `roomConflict`, `searchRooms` |
| FR-017 | Booking form fields | `BookingModal` in `pages/Search.jsx`, `createBookingSchema` |
| FR-018 | Validate interval and required fields | `validators/schemas.js`, `utils/helpers.js` |
| FR-019 | Verify room operational, not blocked, enough capacity | `bookingService.createBooking`, `roomConflict` |
| FR-020 | Detect overlapping bookings | `roomConflict` |
| FR-021 | Never two confirmed bookings overlapping | Row lock plus `prisma/sql/no_double_booking.sql` |
| FR-022 | First come, first served for competing requests | Room row lock (`lockRoom`). Pending requests are listed oldest first. |
| FR-023 | PostgreSQL transactions and locking | `prisma.$transaction` and `lockRoom` in `bookingService.js` |
| FR-024 | Confirm and save the booking | `createBooking` |
| FR-025 | On conflict, inform the user and create nothing | 409 response from `createBooking` |
| FR-026 | Suggest alternative rooms | `findAlternatives` |
| FR-027 | Alternatives are available and operational | `findAlternatives` keeps only `available` rooms |
| FR-028 | Alternatives consider class strength | `findAlternatives` uses the class strength as minimum capacity |
| FR-029 | User picks an alternative or exits | `BookingModal` in `Search.jsx` |
| FR-030 | Show previous, current and upcoming bookings | `GET /bookings/mine`, `pages/MyBookings.jsx` |
| FR-031 | Cancel subject to institutional rules | `bookingService.cancelBooking` (not after the start time) |
| FR-032 | Cancellation releases the slot | Only CONFIRMED bookings hold a slot |
| FR-033 | Update a booking on a schedule or room change | `modifyBooking`, `PATCH /bookings/:id` |
| FR-034 | Retain booking history | Bookings are never deleted. The retention period is still TBD-05. |
| FR-035 | Create a maintenance record | `services/maintenanceService.js`, `pages/Maintenance.jsx` |
| FR-036 | Mark the room unavailable for the period | `roomConflict` checks maintenance blocks |
| FR-037 | Identify overlapping bookings | `createBlock` |
| FR-038 | Identify and notify affected users | `createBlock` records a `BOOKING_AFFECTED` notification for each owner (in-app) |
| FR-039 | Suggest alternatives for affected bookings | `GET /bookings/:id/alternatives`, `RelocateModal` in `MyBookings.jsx` |
| FR-040 | Confirm the replacement | `modifyBooking` (AFFECTED becomes CONFIRMED) |
| FR-041 | Keep the room blocked until staff release it | A block applies until `completedAt` is set |
| FR-042 | Staff mark the room available after maintenance | `PATCH /maintenance/:id/complete` |
| FR-043 | Notification after a booking is confirmed | **In-app only.** Recorded by `notificationService.js` and shown on `pages/Notifications.jsx`. Email is not sent (see note below). |
| FR-044 | Notification on cancel or modify | **In-app only.** `cancelBooking`, `modifyBooking` |
| FR-045 | Notify users hit by maintenance conflicts | **In-app only.** `createBlock` |
| FR-046 | Record notification details and status | `notifications` table, `notify()` |
| FR-047 | Publish availability updates (Socket.IO) | `config/socket.js`, `api/socket.js` |
| FR-048 | HODs and admins see requests to review | `GET /bookings/pending`, `pages/Approvals.jsx` |
| FR-049 | Approve or reject and record the status | `reviewBooking` |
| FR-050 | Decision visible to the requester | Status and note in My bookings, entry on the Notifications page |
| FR-051 | User dashboard | `pages/MyBookings.jsx` |
| FR-052 | Utilisation and booking reports | `services/reportService.js`, `pages/Reports.jsx` |
| FR-053 | Visualise statistics with Chart.js | `pages/Reports.jsx` |

## Deviation from the SRS: email

FR-043, FR-044 and FR-045 say the system shall send **email** notifications, and the SRS names Nodemailer. This version records every notification in the database and shows it in the app, but does not send email. The optional email code in `config/mailer.js` stays switched off unless `SMTP_HOST` is set. If a reviewer asks, describe it as: notifications are implemented in-app, and email delivery is left as a future step.

## Decisions on open (TBD) items

| TBD | Decision made in this version |
|---|---|
| TBD-01 approval | Students need HOD/admin approval. All other roles are confirmed after the conflict check. Change `APPROVAL_ROLES` in `bookingService.js`. |
| TBD-02 role permissions | Defined in the route files through `authorize(...)`. Admins assign roles and departments. |
| TBD-03 API and schema | See [api.md](api.md) and `prisma/schema.prisma`. |
| TBD-04 email | Not used in this version (see above). |
| TBD-05 data retention | Not decided. Bookings are kept indefinitely. |
| TBD-06 languages, accessibility, time zone | English only. Times are stored in UTC and shown in the browser's time zone. Forms use labelled inputs. |
| TBD-07 room data ownership | Admins and lab in-charges maintain room data through the Rooms page. |

## Not covered in this version

- Email delivery of notifications (see above).
- Integration with an institutional timetable system, door locks or access control (out of scope in the SRS).
- Security staff access (listed as TBD in the SRS).
- Email verification at sign-up, login rate limiting, and JWT refresh and revocation (TBD in SRS 5.3).
