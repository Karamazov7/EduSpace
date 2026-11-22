# SRS traceability

Where each functional requirement of the [SRS](SRS.pdf) (version 1.2) is implemented. Paths are relative to `server/src` or `client/src`, depending on the file type.

| ID | Requirement | Implemented in |
|---|---|---|
| FR-001 | Register or log in with institutional identity and department | `routes/authRoutes.js`, `services/authService.js` (nitc.ac.in check), `validators/authValidators.js`, `pages/Register.jsx`, `pages/Login.jsx` |
| FR-002 | JWT tokens for protected operations | `authService.login`, `middleware/authenticate.js` |
| FR-003 | bcrypt password hashes | `authService.js` (12 rounds) |
| FR-004 | Role-based permissions for nine roles | `middleware/authorize.js`, `components/ProtectedRoute.jsx`, `components/Layout.jsx`, `Role` enum in `prisma/schema.prisma` |
| FR-005 | Reject unauthenticated or unauthorised access | `authenticate.js`, `authorize.js` |
| FR-006 | Admin manages roles, departments, active status | `routes/userRoutes.js` (admin routes), `pages/Users.jsx` |
| FR-007 | Create, view, update, deactivate rooms | `routes/roomRoutes.js`, `pages/Rooms.jsx` |
| FR-008 | Room record fields including owning department | `Room` model in `prisma/schema.prisma`, `validators/schemas.js`, room form in `Rooms.jsx` |
| FR-009 | Lab equipment | Equipment endpoints in `roomRoutes.js`, equipment window in `Rooms.jsx` |
| FR-010 | Block unauthorised changes to rooms and equipment | `authorize(...)` and `assertCanManage` in `roomRoutes.js` |
| FR-011 | Room status available to search and booking | `services/availabilityService.js` |
| FR-012 | Search by date, times, type, seats | `GET /rooms/search`, `pages/Search.jsx` |
| FR-013 | Show availability for the slot | `searchRooms` returns `available` and `reason` |
| FR-014 | Show capacity, facilities, department, issues | Room rows in `pages/Search.jsx` |
| FR-015 | Identify rooms with enough seats | `capacity` filter in `searchRooms` |
| FR-016 | Blocked and non-operational rooms are unavailable | `roomConflict`, `searchRooms` |
| FR-017 | Booking form fields | `BookingModal` in `pages/Search.jsx`, `createBookingSchema` |
| FR-018 | Validate interval and fields | `validators/schemas.js`, `assertInterval` and `assertNotPast` in `utils/helpers.js` |
| FR-019 | Verify room operational, not blocked, capacity | `bookingService.createBooking`, `roomConflict` |
| FR-020 | Detect overlapping bookings | `roomConflict` |
| FR-021 | No two overlapping confirmed bookings | Room lock plus `prisma/sql/no_double_booking.sql` |
| FR-022 | First come, first served | Room row lock (`lockRoom`). Pending requests are listed oldest first. |
| FR-023 | Transactions and locking | `prisma.$transaction` and `lockRoom` in `bookingService.js` |
| FR-024 | Confirm and save the booking | `createBooking` |
| FR-025 | On conflict inform, create nothing, offer alternatives | 409 from `createBooking`, `toConflictError` |
| FR-026 | Suggest alternative rooms | `findAlternatives` |
| FR-027 | Alternatives are available and operational | `findAlternatives` keeps only `available` rooms |
| FR-028 | Alternatives consider class strength and type | `findAlternatives` |
| FR-029 | User picks an alternative or exits | `BookingModal` in `Search.jsx` |
| FR-030 | Previous, current and upcoming bookings | `GET /bookings/mine`, `pages/MyBookings.jsx` |
| FR-031 | Cancel (not after start, except admin) | `bookingService.cancelBooking` |
| FR-032 | Cancellation releases the slot | Only CONFIRMED bookings hold a slot |
| FR-033 | Change room, time, strength, purpose | `modifyBooking`, `PATCH /bookings/:id` |
| FR-034 | Retain booking history | Bookings are never deleted. Retention period is TBD-05. |
| FR-035 | Create maintenance record | `services/maintenanceService.js`, `pages/Maintenance.jsx` |
| FR-036 | Room unavailable during maintenance | `roomConflict` checks maintenance blocks |
| FR-037 | Find and mark affected bookings | `createBlock` |
| FR-038 | Notify affected users | `createBlock` records a `BOOKING_AFFECTED` notification per owner |
| FR-039 | Alternatives for affected bookings | `GET /bookings/:id/alternatives`, `RelocateModal` in `MyBookings.jsx` |
| FR-040 | Confirm the replacement | `modifyBooking` (AFFECTED becomes CONFIRMED) |
| FR-041 | Room stays blocked until staff release it | A block applies until `completedAt` is set |
| FR-042 | Staff mark the room available | `PATCH /maintenance/:id/complete` |
| FR-043 | Notification when a booking is confirmed or submitted | `services/notificationService.js` (`notify`), `pages/Notifications.jsx` (For you) |
| FR-044 | Notification on cancel, change, approval, rejection | `cancelBooking`, `modifyBooking`, `reviewBooking`, `tellCancelled` |
| FR-045 | Notify users hit by maintenance | `createBlock` |
| FR-046 | Record notification details and status | `notifications` table, `notify()` |
| FR-047 | Socket.IO change signal | `config/socket.js`, `api/socket.js` (`useRefreshOnChange`) |
| FR-048 | Reviewers can see their requests | `GET /bookings/pending`, `listPending`, `pages/Approvals.jsx` |
| FR-049 | Approve or reject, record the result, re-check on approval | `reviewBooking` |
| FR-050 | Decision visible to the requester | Status and note in My bookings, entry on the Notifications page |
| FR-051 | User dashboard | `pages/MyBookings.jsx` |
| FR-052 | Utilisation and booking reports | `services/reportService.js`, `routes/reportRoutes.js`, `pages/Reports.jsx` |
| FR-053 | Charts with Chart.js | `pages/Reports.jsx` |
| FR-054 | Self-registered accounts are students | `role` removed from `registerSchema`, `authService.register` |
| FR-055 | HOD changes roles in the department | `MANAGEABLE_ROLES.HOD` and `PATCH /users/:id/role` in `userRoutes.js`, `pages/Department.jsx` |
| FR-056 | Faculty makes students class representatives | `MANAGEABLE_ROLES.FACULTY` in `userRoutes.js`, `pages/Department.jsx` |
| FR-057 | No self role change, immediate effect | Self check in `userRoutes.js`, database check in `authenticate.js` |
| FR-058 | Room without department is shared | `department` is optional in `schema.prisma`, fallback in `canReview` |
| FR-059 | Lab in-charge manages own department's labs | `assertCanManage` in `roomRoutes.js`, `canTouch` in `Rooms.jsx` |
| FR-060 | Search refuses out-of-rule times | `assertWithinBookingRules` in the search route, `GET /config`, pickers in `Search.jsx` |
| FR-061 | Booking hours 8 AM to 8 PM, same day | `assertWithinBookingRules` and `OPEN_MINUTES`, `CLOSE_MINUTES` in `utils/helpers.js` |
| FR-062 | One-month booking window | `latestBookableDate`, `MAX_MONTHS_AHEAD` in `utils/helpers.js` |
| FR-063 | Students pending, others confirmed | `APPROVAL_ROLES` in `bookingService.js` |
| FR-064 | Only confirmed bookings hold a room | `roomConflict` checks CONFIRMED only, re-check in `reviewBooking` |
| FR-065 | Cancel competing pending requests automatically | `cancelCompetingPending`, `tellCancelled` in `bookingService.js` |
| FR-066 | Campus updates feed | `Broadcast` model, `broadcastSafe`, `GET /notifications/campus`, `pages/Notifications.jsx` (Campus updates) |
| FR-067 | Notify reviewers of a new request | `notifyReviewers` in `bookingService.js` |
| FR-068 | Optional email, off by default | `config/mailer.js` (only when `SMTP_HOST` is set) |
| FR-069 | Department rule for reviewing | `canReview`, `reviewableBy` in `bookingService.js` |
| FR-070 | Review policy is one setting | `REVIEW_BY` in `bookingService.js` |
| FR-071 | Dynamic utilisation chart | `pages/Reports.jsx` (axis scaling, value labels, hours or percent), `services/reportService.js` |
| FR-072 | Request a password reset with email and college ID, with an identical answer for every input | `POST /auth/forgot-password` in `routes/authRoutes.js`, `requestReset` in `services/passwordResetService.js`, `pages/ForgotPassword.jsx`, link on `pages/Login.jsx` |
| FR-073 | Administrators are notified of and can list reset requests | `requestReset` (notification `PASSWORD_RESET_REQUESTED`), `GET /users/reset-requests`, box on `pages/Users.jsx` |
| FR-074 | Administrator creates a one-time, 24-hour reset link, stored only as a hash | `issueLink` in `services/passwordResetService.js`, `POST /users/:id/reset-link` in `routes/userRoutes.js`, link window in `pages/Users.jsx`, `PasswordReset` model |
| FR-075 | A valid link sets a new password once | `resetPassword` in `services/passwordResetService.js`, `POST /auth/reset-password`, `pages/ResetPassword.jsx`, `passwordRule` in `validators/authValidators.js` |
| FR-076 | Older logins stop working after a reset, and the user is notified | `passwordChangedAt` check in `middleware/authenticate.js`, notification `PASSWORD_CHANGED` |

## Non-functional requirements and business rules

| Area | Where it is handled |
|---|---|
| NFR-02, NFR-20 (no duplicate bookings under concurrency) | Room lock, `no_double_booking.sql` |
| NFR-04 (notifications do not slow bookings) | `notifySafe` and `broadcastSafe` run without waiting |
| NFR-09 to NFR-12 (login, roles, passwords, tokens) | `authenticate.js`, `authorize.js`, `authService.js` |
| NFR-14 (input validation) | `middleware/validate.js`, `validators/` |
| NFR-15 (secrets) | `.env`, listed in `.gitignore` |
| NFR-17 (parameterised queries) | Prisma client and tagged `$queryRaw` |
| NFR-18, BR-17 (no personal data in campus updates) | Message text built in `bookingService.js` and `maintenanceService.js` |
| BR-07 to BR-11 (approval, hours, window, review rule) | `bookingService.js`, `utils/helpers.js` |
| BR-16 (role change limits) | `userRoutes.js` |

## Decisions on open (TBD) items

| TBD | Decision in this version |
|---|---|
| TBD-01 approval | Students need approval. All other roles, including class representatives, are confirmed after the conflict check. |
| TBD-02 role permissions | Defined in Appendix D of the SRS and in the route files. |
| TBD-03 API and schema | See [api.md](api.md) and `prisma/schema.prisma`. |
| TBD-04 email | Not used. Optional and off by default (FR-068). Password reset links are handed over by an administrator instead of emailed. |
| TBD-05 data retention | Open. Bookings are kept indefinitely. |
| TBD-06 languages, accessibility, time zone | English. Times stored in UTC, rules evaluated in IST. Accessibility target open. |
| TBD-07 room data ownership | Admins and lab in-charges maintain rooms. Each room can have an owning department. |
| TBD-08 two-step approval across departments | Open. Either department may approve (`REVIEW_BY`). |
| TBD-09 hours and window by role or room type | Open. The same rules apply to everyone. |
| TBD-10 approval for non-students booking another department's lab | Open. They are confirmed immediately. |

## Not covered in this version

- Email delivery of notifications as the default (see FR-068).
- Integration with an institutional timetable system, door locks or access control (out of scope in the SRS).
- Security staff access (listed as TBD in the SRS).
- Email verification at sign-up, login and reset-request rate limiting, a "change password" page for logged-in users, password reset links issued by HODs, and JWT refresh and revocation.
