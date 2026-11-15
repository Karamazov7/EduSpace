# Local setup (Windows 11)

## 1. Install the tools

| Tool | Notes |
|---|---|
| Node.js 20 or newer | Check with `node -v` |
| PostgreSQL | Keep port 5432. Remember the `postgres` password. |
| Git | Check with `git --version` |
| VS Code | Optional extension: Thunder Client for testing the API |

## 2. Create the database

In pgAdmin or SQL Shell (psql):

```sql
CREATE DATABASE classroom_booking;
```

## 3. Backend

```powershell
cd server
copy .env.example .env
```

Open `server/.env` and set at least:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/classroom_booking?schema=public"
JWT_SECRET=any_long_random_text_for_development
```

If your password contains characters such as `@`, `#` or `/`, URL-encode them (for example `@` becomes `%40`).

Then run:

```powershell
npm install
npx prisma migrate dev --name init   # creates the tables
npm run db:constraints               # adds the no-double-booking rule
npm run db:seed                      # demo users and rooms
npm run dev
```

Check http://localhost:5000/api/health. You should see `{"status":"ok", ...}`.

When you pull changes that edit `prisma/schema.prisma`, run `npx prisma migrate dev` again (and `npx prisma generate` if the server complains about the Prisma client).

## 4. Frontend

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173 and log in with `admin@nitc.ac.in` and `Password1`.

## 5. First things to set up

1. **Rooms page (as admin).** Set the **owning department** of each lab (for example `CSE` for the CS labs). Leave shared lecture halls empty.
2. **Users page (as admin).** Check that every HOD, faculty member and lab in-charge has a department. Reviewers without one see no requests.
3. Try a booking as a student and approve it as the HOD or faculty member.

## 6. Useful tools

| Goal | How |
|---|---|
| Look at the data | `npx prisma studio` (opens http://localhost:5555) or pgAdmin |
| Remove all bookings and notifications | In psql: `TRUNCATE bookings, notifications, broadcasts RESTART IDENTITY;` |
| Remove only past bookings | `DELETE FROM bookings WHERE end_time < NOW();` |
| Wipe everything and start over | `npx prisma migrate reset`, then `npm run db:constraints` and `npm run db:seed` |

`migrate reset` removes the double-booking rule along with all data, so always run `npm run db:constraints` again afterwards.

## Common problems

| Problem | Fix |
|---|---|
| `P1001: Can't reach database server` | PostgreSQL isn't running, or `DATABASE_URL` is wrong |
| `JWT_SECRET is not set` | `.env` is missing, or you started the server outside `server/` |
| Changed `.env` but nothing happened | Restart the server. nodemon doesn't watch `.env`. |
| `Cannot find module ... .js` | A relative import is missing its `.js` ending (the project uses ES modules) |
| Login works but pages show 401 | Clear the saved token: in the browser console run `localStorage.clear()` |
| Registration says "Department is required" | Fill in the department field. It is mandatory. |
| A booking says it must be between 8:00 AM and 8:00 PM | That is the booking rule. Pick a time inside opening hours. |
| A faculty member's Approvals page is empty | Their account has no department, or no student request matches their department or rooms |
| `prisma.broadcast is undefined` | Run `npx prisma migrate dev` and `npx prisma generate`, then restart the server |
