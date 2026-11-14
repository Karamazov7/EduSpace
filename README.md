# EduSpace (Smart Classroom and Lab Booking )

A web app for searching, booking and managing classrooms and labs at NIT Calicut. It prevents double bookings, suggests alternative rooms, handles maintenance and shows utilisation reports.

Tech Stack: React (Vite) + Node.js/Express (ES modules) + PostgreSQL through Prisma 6.

## Features

- Registration and login with JWT and bcrypt. Only `@nitc.ac.in` emails can sign up, and every new account starts as a student.
- Eight roles with role-based access: student, faculty, admin, lab in-charge, HOD, timetable coordinator, maintenance staff, management.
- Room search by date, time, room type and seats, with availability shown for the chosen slot.
- Booking with conflict detection, first-come-first-served handling of simultaneous requests, and a database rule that makes double booking impossible.
- Alternative room suggestions when a room is taken.
- HOD or admin approval for student bookings, shown to the HOD of the student's department.
- Maintenance blocks that flag affected bookings and let their owners choose a new room.
- In-app notifications for booking events.
- Admin pages for users, roles, departments, rooms and lab equipment.
- Utilisation reports with Chart.js, and optional live updates over Socket.IO.

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

| Email                  | Role                                       |
| ---------------------- | ------------------------------------------ |
| admin@nitc.ac.in       | Admin                                      |
| hod.cse@nitc.ac.in     | HOD (CSE)                                  |
| faculty@nitc.ac.in     | Faculty (bookings are confirmed instantly) |
| student@nitc.ac.in     | Student (bookings wait for approval)       |
| lab@nitc.ac.in         | Lab in-charge                              |
| maintenance@nitc.ac.in | Maintenance staff                          |
| timetable@nitc.ac.in   | Timetable coordinator                      |
| principal@nitc.ac.in   | Management (reports)                       |

## Project structure

```
smart-classroom-booking/
├── README.md
├── docs/                    guides, API reference, SRS
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
        └── utils/
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

| Variable                  | Meaning                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`            | PostgreSQL connection string                                                                     |
| `JWT_SECRET`              | Long random text that signs login tokens                                                         |
| `JWT_EXPIRES_IN`          | How long a login lasts (default `1d`)                                                            |
| `CLIENT_URL`              | Address of the website (default `http://localhost:5173`)                                         |
| `ALLOWED_EMAIL_DOMAIN`    | Domain allowed to register (default `nitc.ac.in`)                                                |
| `OPERATING_HOURS_PER_DAY` | Hours a room is usable per day, used for utilisation % in reports                                |
| `SMTP_*`                  | Leave empty. Email sending is not used, see [notifications](docs/architecture.md#notifications). |

## Documentation

| Document                                             | Contents                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [docs/setup-local.md](docs/setup-local.md)           | Running the project on your computer                       |
| [docs/api.md](docs/api.md)                           | Every API endpoint                                         |
| [docs/architecture.md](docs/architecture.md)         | System design, data model, how double booking is prevented |
| [docs/user-guide.md](docs/user-guide.md)             | What each role can do                                      |
| [docs/testing.md](docs/testing.md)                   | Test checklist                                             |
| [docs/srs-traceability.md](docs/srs-traceability.md) | Which code implements each SRS requirement                 |

## Policies we can change

- **Who needs approval (TBD-01):** `APPROVAL_ROLES` in `server/src/services/bookingService.js`. Default: students.
- **Who holds which role (TBD-02):** admins change roles and departments on the Users page.
- **Data retention (TBD-05):** booking history is kept until the institution decides otherwise.
