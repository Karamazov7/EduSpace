# Putting the app online

This guide uses three free services. The prices and limits below were checked in November 2026 and providers change them, so check each pricing page before you rely on them.

| Part | Service | Why this one |
|---|---|---|
| App (website + API in one service) | **Render** web service | Runs Node, supports WebSockets, deploys from GitHub, gives you HTTPS |
| Database | **Neon** PostgreSQL | Render's free database expires after about 30 days, Neon's free database does not |
| Email | **Brevo** | Render's free plan blocks SMTP ports, so email must go through an HTTPS API. Brevo's free plan allows 300 emails a day |

Good to know about the free setup:

- A free Render service goes to sleep after 15 minutes without visitors, and the next visit takes about a minute to wake it. Fine for a demo or project review. A paid instance (from about $7 a month) removes this.
- Neon pauses its database after a few idle minutes too, so the first request after a quiet period can be a little slow.
- Neon's free plan has about 1 GB of storage per project, which is plenty for this app.

If your college gives you a server, see [Option B](#option-b-a-college-server) at the end.

## How it works online

In production one Node server does everything: it answers `/api/...` requests and also serves the built React website. That means one address, no CORS problems, and Socket.IO live updates work without extra setup. The `render.yaml` file and build command below set this up.

## Option A: Render + Neon + Brevo

### Step 1: Put the code on GitHub

1. Create a GitHub repository (private is fine) and push the whole project: the folders `client`, `server`, `docs` and the files in the root.
2. Check that `server/prisma/migrations/` is in the repository. It is created by `npx prisma migrate dev`, and the live database is built from it. If you haven't run that command yet, run it locally first.
3. Check that `.env` is **not** in the repository. `.gitignore` already excludes it.

```powershell
git add .
git commit -m "Prepare for deployment"
git push
```

### Step 2: Create the database on Neon

1. Sign up at neon.com (no credit card needed) and create a project. Pick the **Singapore** region, which is the closest to India.
2. Open the project's **Connect** dialog. **Turn connection pooling off** to get the *direct* connection string. It looks like `postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Add `&connect_timeout=15` at the end so the app waits for the database to wake up:
   ```
   postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15
   ```
4. Keep this string safe. It is your `DATABASE_URL`.

### Step 3: Set up email on Brevo

Follow "Option A: Brevo" in [email-notifications.md](email-notifications.md). You need two things: a **verified sender address** and an **API key**.

### Step 4: Create the web service on Render

1. Sign up at render.com with your GitHub account.
2. Choose **New** → **Web Service**, and pick your repository. (Or choose **New** → **Blueprint** to use `render.yaml`, then skip to the environment variables.)
3. Fill in the form:

   | Field | Value |
   |---|---|
   | Name | Something short, for example `nitc-room-booking`. Your address will be `https://nitc-room-booking.onrender.com` |
   | Language | Node |
   | Region | Singapore |
   | Root directory | leave empty |
   | Build command | `cd client && npm install --include=dev && npm run build && cd ../server && npm install && npx prisma generate && npx prisma migrate deploy && npm run db:constraints` |
   | Start command | `cd server && npm start` |
   | Instance type | Free |
   | Health check path | `/api/health` |

4. Add these **environment variables**:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `NODE_VERSION` | `22` |
   | `DATABASE_URL` | the Neon string from step 2 |
   | `JWT_SECRET` | a long random value (see below) |
   | `CLIENT_URL` | `https://your-service-name.onrender.com` (the address Render shows) |
   | `ALLOWED_EMAIL_DOMAIN` | `nitc.ac.in` |
   | `MAIL_PROVIDER` | `brevo` |
   | `BREVO_API_KEY` | your Brevo API key |
   | `MAIL_FROM_EMAIL` | the sender you verified in Brevo |
   | `MAIL_FROM_NAME` | `NITC Room Booking` |

   Make a `JWT_SECRET` in PowerShell:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

5. Click **Create Web Service**. The first build takes a few minutes. When the log says the service is live, open `https://your-service-name.onrender.com/api/health`. You should see `{"status":"ok", ...}`.

If the address Render gives you differs from the `CLIENT_URL` you guessed, correct the variable and redeploy.

What the build command does, in order: builds the React site, installs the server, generates the Prisma client, creates or updates the database tables from your migrations, and applies the no-double-booking rule.

### Step 5: Create the first admin

Do **not** run `npm run db:seed` online, because it creates demo accounts with a publicly known password. Create one real admin from your own computer instead:

```powershell
cd server
$env:DATABASE_URL = "your Neon string here"
$env:ADMIN_EMAIL = "you@nitc.ac.in"
$env:ADMIN_PASSWORD = "a-strong-password-of-10+-characters"
$env:ADMIN_NAME = "Your Name"
$env:ADMIN_COLLEGE_ID = "ADMIN001"
npm run db:create-admin
Remove-Item Env:DATABASE_URL, Env:ADMIN_PASSWORD
```

Then open your site, log in, and use the **Rooms** page to add the real classrooms and labs, and the **Users** page to give people their roles and departments.

### Step 6: Test it live

1. Register a student account with a real `@nitc.ac.in` address and a department.
2. Log in as admin and set up a faculty member and an HOD (role and department) on the Users page.
3. As the student, book a room. The HOD should get an email, and the request should appear on **Approvals**.
4. Approve it, and check that the student gets an email.

Run through [testing.md](testing.md) for the full checklist.

### Updating the live site

Push to GitHub. Render rebuilds and redeploys automatically, and `prisma migrate deploy` applies any new migrations. After you change `prisma/schema.prisma` locally, run `npx prisma migrate dev --name describe_the_change` and commit the new folder in `prisma/migrations/`.

### Keeping the free service awake (optional)

A free monitoring service such as UptimeRobot can request `https://your-service-name.onrender.com/api/health` every 5 minutes, which keeps the app from sleeping. Render gives a workspace 750 free hours a month, enough for one service running all day. This is a workaround, so move to a paid instance if the app matters to many people.

## Option B: a college server

If the institute gives you a Linux server (for example Ubuntu), this is also the better home for real use, because the data stays on campus and SMTP to the college mail server usually works (use `MAIL_PROVIDER=smtp`).

1. Install Node.js 20 or newer, PostgreSQL and Nginx. Create a database and a database user.
2. Copy the project to the server (`git clone`), then:
   ```bash
   cd client && npm install --include=dev && npm run build && cd ..
   cd server && npm install
   cp .env.example .env     # set DATABASE_URL, JWT_SECRET, CLIENT_URL (https://your.domain), NODE_ENV=production, mail settings
   npx prisma generate
   npx prisma migrate deploy
   npm run db:constraints
   npm run db:create-admin  # with the ADMIN_* variables set
   ```
3. Keep it running with PM2:
   ```bash
   sudo npm install -g pm2
   pm2 start src/server.js --name room-booking
   pm2 save && pm2 startup
   ```
4. Put Nginx in front, with WebSocket support for live updates:
   ```nginx
   server {
     server_name rooms.example.ac.in;
     location / {
       proxy_pass http://127.0.0.1:5000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
5. Turn on HTTPS with Certbot: `sudo certbot --nginx -d rooms.example.ac.in`.
6. Back up the database regularly: `pg_dump classroom_booking > backup.sql`.

## Before real users arrive

- [ ] `JWT_SECRET` is long and random, and is not in GitHub.
- [ ] Demo seed accounts do not exist on the live database.
- [ ] The site uses HTTPS (Render and Certbot do this for you).
- [ ] An email test passed (`npm run mail:test -- you@example.com`, or a real booking).
- [ ] Someone has a plan for database backups. Do not rely only on the provider's built-in history: keep your own `pg_dump` copies too.
- [ ] Not built yet, worth adding for a real launch: login rate limiting and email verification at sign-up.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| Build fails with `vite: not found` | The client install skipped dev packages. Keep `--include=dev` in the build command. |
| Build fails at `prisma migrate deploy` | `server/prisma/migrations` isn't in GitHub, or `DATABASE_URL` is wrong |
| `P1001` or timeouts at start | Neon is waking up. Check `connect_timeout=15` is on the URL, and use the **direct** (non-pooled) string. |
| Site loads but login fails | Check the Render logs. Usually `DATABASE_URL`, or `JWT_SECRET` is missing. |
| Blank page after a refresh on `/bookings` | `NODE_ENV` isn't `production`, so the server isn't serving the website |
| Emails don't arrive | See the troubleshooting table in [email-notifications.md](email-notifications.md) |
| Everything is slow after quiet periods | Free-tier sleeping (Render and Neon). Use a keep-alive ping or a paid plan. |
