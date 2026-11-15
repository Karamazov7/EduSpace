# EduSpace ( Smart Classroom and Lab Booking )

A web app for searching, booking and managing classrooms and labs at NIT Calicut. It prevents double bookings, suggests alternative rooms, routes student requests to the right reviewers, handles maintenance and shows utilisation reports.

Built from the project's [SRS](docs/SRS.pdf) (version 1.2): React (Vite) + Node.js/Express (ES modules) + PostgreSQL through Prisma 6.

## Features

- **Accounts and roles.** Registration and login with JWT and bcrypt. Only `@nitc.ac.in` emails can sign up, a department is required, and every new account starts as a student.
- **Nine roles:** student, class representative, faculty, admin, lab in-charge, HOD, timetable coordinator, maintenance staff, management.
- **Role management inside a department.** A HOD can make students faculty or class representatives. Faculty can make students class representatives. Admins manage everyone.
- **Room search** by date, time, room type and seats, with availability, reasons and owning department shown for each room.
- **Booking rules.** Rooms can be booked from **8:00 AM to 8:00 PM** and up to **one month ahead**, on a single day.
- **No double booking.** Simultaneous requests are handled one at a time, and a database rule rejects overlapping confirmed bookings.
- **Approval flow.** Students' requests need approval. Class representatives, faculty and all other roles are confirmed immediately.
- **Department-aware approvals.** Rooms can belong to a department. Faculty, HODs and lab in-charges review requests for their own department, so an ECE student booking a CSE lab can be approved by either department.
- **Automatic cancellation.** When one request is approved, the other pending requests for the same room and an overlapping time are cancelled automatically, and those students are told.
- **Alternative rooms** when a room is taken, and a way to pick a new room when maintenance blocks a booking.
- **Notifications.** A personal list ("For you") and a **campus updates** feed that every user sees (rooms booked, freed, closed for maintenance), with no personal data.
- **Reports** with Chart.js: utilisation by room in hours or percent (the axis scales to the data), bookings by status and by department.
- **Live updates** over Socket.IO, so pages refresh without reloading.

## Quick start (Windows, PowerShell)

1. Install Node.js 20 or newer and PostgreSQL. Create the database: `CREATE DATABASE classroom_booking;`
2. Backend:
   ```powershell
   cd server
   copy .env.example .env      # put your real database password in DATABASE_URL
   npm install
   npx prisma migrate dev --name init
   npm run db:constraints      # the no-double-booking rule
   npm run db:seed             # demo users and rooms
   npm run dev
   ```
3. Frontend, in a second terminal:
   ```powershell
   cd client
   npm install
   npm run dev
   ```
4. Open http://localhost:5173

More detail: [docs/setup-local.md](docs/setup-local.md).

## Demo logins (after seeding)

Password for all: `Password1`

| Email                  | Role                                                            |
| ---------------------- | --------------------------------------------------------------- |
| admin@nitc.ac.in       | Admin                                                           |
| hod.cse@nitc.ac.in     | HOD (CSE)                                                       |
| faculty@nitc.ac.in     | Faculty (CSE)                                                   |
| student@nitc.ac.in     | Student (CSE). Bookings wait for approval.                      |
| cr@nitc.ac.in          | Class representative (CSE). Bookings are confirmed immediately. |
| lab@nitc.ac.in         | Lab in-charge (CSE)                                             |
| maintenance@nitc.ac.in | Maintenance staff                                               |
| timetable@nitc.ac.in   | Timetable coordinator                                           |
| principal@nitc.ac.in   | Management (reports)                                            |

The seed can also create `ece.student@nitc.ac.in` and `hod.ece@nitc.ac.in` for trying cross-department approvals. If your seed file does not list them, register an ECE student and ask an admin to make another account an ECE HOD.

## Project structure

```
smart-classroom-booking/
├── README.md
├── docs/                    guides, API reference, SRS (Word and PDF)
├── client/                  React app (Vite)
│   └── src/ api, components, context, pages, utils
└── server/
    ├── prisma/              schema.prisma, sql/no_double_booking.sql, seed.js
    └── src/
        ├── config/          prisma, socket (mailer is optional and off by default)
        ├── controllers/     auth
        ├── middleware/      authenticate, authorize, validate, errorHandler
        ├── routes/          one file per area
        ├── services/        booking, availability, maintenance, notification, report, auth
        ├── validators/      zod schemas
        └── utils/           helpers (booking hours and window rules live here)
```

## Scripts (run inside `server/`)

| Command                  | What it does                                                |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`            | Start the API with auto-restart                             |
| `npm run db:migrate`     | Create or apply migrations during development               |
| `npm run db:constraints` | Add the no-double-booking database rule (safe to run again) |
| `npm run db:seed`        | Demo users and rooms                                        |
| `npm run db:studio`      | Browse the database in the browser                          |

## Settings (`server/.env`)

| Variable                  | Meaning                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | PostgreSQL connection string                                                                    |
| `JWT_SECRET`              | Long random text that signs login tokens                                                        |
| `JWT_EXPIRES_IN`          | How long a login lasts (default `1d`)                                                           |
| `CLIENT_URL`              | Address of the website (default `http://localhost:5173`)                                        |
| `ALLOWED_EMAIL_DOMAIN`    | Domain allowed to register (default `nitc.ac.in`)                                               |
| `OPERATING_HOURS_PER_DAY` | Optional. Hours a room is open per day, for utilisation %. Default 12.                          |
| `SMTP_*`                  | Leave empty. Email sending is not used, see [architecture](docs/architecture.md#notifications). |

## Rules at a glance

| Rule                                                                | Where to change it                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Opening hours (8:00 AM to 8:00 PM) and the one-month window         | `server/src/utils/helpers.js` (`OPEN_MINUTES`, `CLOSE_MINUTES`, `MAX_MONTHS_AHEAD`) |
| Who needs approval (default: students)                              | `APPROVAL_ROLES` in `server/src/services/bookingService.js`                         |
| Which department may approve (default: the student's or the room's) | `REVIEW_BY` in `server/src/services/bookingService.js`                              |
| Roles a HOD or faculty may hand out                                 | `MANAGEABLE_ROLES` in `server/src/routes/userRoutes.js`                             |

## Documentation

| Document                                                     | Contents                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [docs/SRS.pdf](docs/SRS.pdf), [docs/SRS.docx](docs/SRS.docx) | The Software Requirements Specification, version 1.2 (PDF to read, Word to edit) |
| [docs/setup-local.md](docs/setup-local.md)                   | Running the project on your computer                                             |
| [docs/api.md](docs/api.md)                                   | Every API endpoint                                                               |
| [docs/architecture.md](docs/architecture.md)                 | System design, data model, booking rules, approvals                              |
| [docs/user-guide.md](docs/user-guide.md)                     | What each role can do                                                            |
| [docs/testing.md](docs/testing.md)                           | Test checklist                                                                   |
| [docs/srs-traceability.md](docs/srs-traceability.md)         | Which code implements each SRS requirement                                       |

## Before you start using it for real

- Set a **department** for every HOD, faculty member and lab in-charge, and for every room you want a department to own (Users and Rooms pages). Reviewers without a department see no requests.
- Keep `.env` out of Git.
- Decide the open policy questions listed in Appendix C of the SRS (data retention, email, accessibility).
