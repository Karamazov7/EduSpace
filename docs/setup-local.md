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

If you already have a `users` table from an earlier step, `migrate dev` adds the new tables to it.

## 4. Frontend

In a second terminal:

```powershell
cd client
npm install
npm run dev
```

Open http://localhost:5173 and log in with `admin@nitc.ac.in` and `Password1`.

## 5. Useful tools

| Goal | How |
|---|---|
| Look at the data | `npx prisma studio` (opens http://localhost:5555) or pgAdmin |
| Remove all bookings and notifications | In psql: `TRUNCATE bookings, notifications RESTART IDENTITY;` |
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
