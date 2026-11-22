# Testing

Start the server and the client first (see [setup-local.md](setup-local.md)) and seed the database. Use the demo logins from the README. For the cross-department tests you need an ECE student and an ECE HOD (register them, then let an admin set the HOD role).

## Check the database rule itself

Even without the application checks, PostgreSQL must refuse an overlap. In psql or pgAdmin, insert one `CONFIRMED` booking for a room, then try to insert a second one for the same room with an overlapping time. The second insert must fail with an error mentioning `bookings_no_overlap`.

## Check simultaneous requests

1. Log in as `faculty@nitc.ac.in` in one browser window and as `admin@nitc.ac.in` in a private window. Both search the same room and time.
2. Open the booking form in both and press **Confirm booking** in both as close together as you can.
3. One booking must be confirmed. The other must show "Already booked for this time" with alternative rooms.

For a harder test, send the same `POST /api/bookings` request many times at once from Thunder Client or Postman. Only one may return `201`, and all the others must return `409`.

## Manual test checklist

### Accounts and roles

| Test | Expected |
|---|---|
| Register with `test@gmail.com` | Refused: use your institutional email |
| Register with a weak password such as `abc` | Refused, with the reasons listed |
| Register without a department | Refused |
| Register the same email or college ID twice | 409 |
| Register while sending `"role": "ADMIN"` through the API | The account is created as a student |
| Wrong password, or an unknown email | The same "Invalid email or password" message |
| Student opens `/users`, `/approvals` or `/department` | Redirected home. The API returns 403. |
| Admin deactivates a user | Their login fails, and their old token stops working at once |

### Forgot password

| Test | Expected |
|---|---|
| Request a reset with a correct email and college ID | A neutral message, and the admin gets a notification |
| Request with a wrong college ID, an unknown email or a deactivated account | The same neutral message, and nothing is recorded |
| Request twice in a row | Only one request waits for the admin |
| Admin opens Users | The waiting request appears at the top |
| A student or faculty member calls the admin reset endpoints | 403 |
| Admin presses Create reset link | A link is shown once, built from `CLIENT_URL` |
| Open the link and set a weak password such as `abc` | Refused, with the reasons |
| Open the link and set a valid new password | Password changed, and the user is notified |
| Log in with the old password, then the new one | The old one fails, the new one works |
| Open the same link a second time | "Invalid or has expired" |
| Create two links for one person, then use the older one | Refused. Only the newest works. |
| A user is logged in on another browser while an admin resets their password | After the reset, that old session is sent back to the login page |
| Use a link after 24 hours | Refused |
| Admin dismisses a request | It disappears from the list |

### Role changes inside a department

| Test | Expected |
|---|---|
| CSE HOD makes a CSE student faculty | Works |
| CSE HOD makes a CSE student a class representative | Works |
| CSE HOD changes an ECE student's role | 403 |
| CSE HOD tries to make someone HOD or lab in-charge | Refused |
| CSE faculty makes a CSE student a class representative, then back to student | Works |
| CSE faculty tries to make a student faculty | 403 |
| Anyone changes their own role | 400 |
| Faculty or HOD with no department opens My department | Told to ask an admin to set a department |

### Booking rules

| Test | Expected |
|---|---|
| Book from 7:30 AM to 9:00 AM | Refused: rooms can only be booked between 8:00 AM and 8:00 PM |
| Book from 7:30 PM to 8:30 PM | Refused |
| Book from 7:00 PM to 8:00 PM | Allowed |
| Book from 11:00 PM to 1:00 AM | Refused: must start and end on the same day |
| Pick a date more than one month ahead | The date picker stops at the last allowed date. Through the API, refused with 400. |
| Search for a time outside the rules through the API | 400 |
| Search with an end time before the start time | Refused |
| Book with a class strength above the room's capacity | Refused, with the room's capacity |
| Book 10:00 to 11:00, then 11:00 to 12:00 in the same room | Both allowed (no overlap) |

### Booking and approval

| Test | Expected |
|---|---|
| Faculty books a free room | Confirmed immediately |
| Class representative books a free room | Confirmed immediately |
| Student books a free room | Pending, and a notification is recorded |
| Two users book the same slot | One succeeds, the other sees alternative rooms |
| Cancel an upcoming booking | The slot becomes free again |
| Try to cancel a booking that has started | Refused (admins can) |
| CSE HOD opens Approvals | Sees pending requests from CSE students and for CSE-owned rooms, oldest first |
| Approve a request | Becomes Confirmed, and the student gets a notification |
| Approve a request whose slot was taken meanwhile | Refused, and the reviewer is told to reject it |
| Reject with a note | The student sees the note in My bookings |

### Cross-department approval

Set CS-LAB-1's owning department to `CSE`. Then an ECE student books CS-LAB-1.

| Reviewer | Expected |
|---|---|
| ECE HOD or ECE faculty | Sees the request and can decide it (it is their student) |
| CSE HOD, CSE faculty | Sees the request and can decide it (it is their lab) |
| CSE lab in-charge | Sees the request and can decide it |
| ECE lab in-charge | Does not see it |
| HOD of a third department | Does not see it. 403 if the request is approved through the API. |
| Admin | Sees it |
| Faculty with no department | Sees nothing |

Change `REVIEW_BY` to `owner` or `requester` in `bookingService.js` to see the other policies.

### Automatic cancellation

| Test | Expected |
|---|---|
| Three students request the same room, overlapping times | All three are pending |
| A reviewer approves one | The other two become Cancelled with the reason, and those students get a "cancelled automatically" notification |
| A student asked for a different time | That request is untouched |
| A student's pending request, then faculty books the same slot | Faculty is confirmed, and the student's request is cancelled automatically |
| Try to approve one of the cancelled requests | Refused |

### Notifications

| Test | Expected |
|---|---|
| Book, then cancel a confirmed room | The campus updates tab shows "booked", then "free again", with no names |
| Block a room for maintenance, then mark it available | Campus updates show "closed for maintenance", then "available again" |
| Open Notifications in two browsers and make a booking in one | The other page updates without a refresh |
| A request is approved or auto-cancelled | The student's "For you" tab shows it |

### Maintenance

| Test | Expected |
|---|---|
| Block a room that has a confirmed booking | The booking becomes "needs a new room", and the owner gets a notification |
| The owner chooses a replacement room | The booking is confirmed in the new room |
| Search during the blocked period | The room shows "Blocked for maintenance" |
| Mark the room available | It can be booked again |

### Rooms and labs

| Test | Expected |
|---|---|
| CSE lab in-charge edits a CSE lab | Works |
| CSE lab in-charge edits an ECE lab or a classroom | 403 |
| CSE lab in-charge creates a lab | It belongs to CSE automatically |
| Admin sets or clears a room's owning department | Saved, and shown in search and Approvals |

### Reports

| Test | Expected |
|---|---|
| Open Reports as admin, HOD or management | Charts and totals for the date range |
| Make one 1-hour booking, then open Reports | The room's bar is clearly visible, with its value beside it |
| Switch between Hours and Percent | The axis rescales each time |
| Open Reports as a student | Not allowed |

## Quick checks without a database

Some behaviour can be checked even when the database isn't connected: a request without a token returns 401, an invalid registration returns 400 with field details, `GET /api/config` returns the booking rules, and an unknown API path returns a JSON 404.
