# Testing

Start the server and the client first (see [setup-local.md](setup-local.md)) and seed the database. Use the demo logins from the README.

## Check the database rule itself

Even without the application checks, PostgreSQL must refuse an overlap. In psql or pgAdmin, insert one `CONFIRMED` booking for a room, then try to insert a second one for the same room with an overlapping time. The second insert must fail with an error mentioning `bookings_no_overlap`.

## Check simultaneous requests

The "two people book at once" case is the main thing the SRS asks to test (SRS 5.4, Testability).

1. Log in as `faculty@nitc.ac.in` in one browser window and as `admin@nitc.ac.in` in a private window. Both search the same room and time.
2. Open the booking form in both, fill it in, and press **Confirm booking** in both as close together as you can.
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
| Register while sending `"role": "ADMIN"` through the API | The account is created as a student (the field is ignored) |
| Wrong password, or an unknown email | The same "Invalid email or password" message |
| Student opens `/users` or `/approvals` | Redirected home. The API returns 403. |
| Admin deactivates a user | Their login fails, and their old token stops working at once |

### Booking

| Test | Expected |
|---|---|
| Search with an end time before the start time | Refused |
| Search with more seats than any room has | "No rooms match" message |
| Book with a class strength above the room's capacity | Refused, with the room's capacity |
| Faculty books a free room | Confirmed immediately |
| Student books a free room | Pending, and a notification is recorded |
| Two users book the same slot | One succeeds, the other sees alternative rooms |
| Book 10:00 to 11:00, then 11:00 to 12:00 in the same room | Both allowed (no overlap) |
| Cancel an upcoming booking | The slot becomes free again |
| Try to cancel a booking that has started | Refused (admins can) |

### Approvals

| Test | Expected |
|---|---|
| HOD (CSE) opens Approvals | Sees only CSE students' requests, oldest first |
| Approve a request | Becomes Confirmed, and the student gets a notification |
| Approve a request whose slot was taken meanwhile | Refused, and the HOD is told to reject it |
| Reject with a note | The student sees the note in My bookings |
| Change a student's department on the Users page | Their later requests go to the other department's HOD |

### Maintenance

| Test | Expected |
|---|---|
| Block a room that has a confirmed booking | The booking becomes "needs a new room", and the owner gets a notification |
| The owner chooses a replacement room | The booking is confirmed in the new room |
| Search during the blocked period | The room shows "Blocked for maintenance" |
| Mark the room available | It can be booked again |

### Reports

| Test | Expected |
|---|---|
| Open Reports as admin, HOD or management | Charts and totals for the date range |
| Open Reports as a student | Not allowed |

## Quick checks without a database

Some behaviour can be checked even when the database isn't connected: a request without a token returns 401, an invalid registration returns 400 with field details, and an unknown API path returns a JSON 404.
