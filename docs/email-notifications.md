# Email notifications

Requirements covered: FR-043 to FR-046 and TBD-04 (templates, provider, retry policy).

## What gets emailed

| Event | Who receives it |
|---|---|
| Booking confirmed straight away (faculty and other non-students) | The person who booked |
| Booking request sent for approval | The requester, and the reviewers: the HOD of the requester's department, or all admins if that department has no HOD |
| Request approved or rejected | The requester (with the reviewer's note, if any) |
| Booking cancelled | The owner of the booking, also when an admin cancels it |
| Booking changed, or a replacement room chosen | The owner |
| Room blocked for maintenance while it has a booking | The owner of each affected booking |

Not emailed: account creation, and maintenance being marked complete.

Every notification is also saved in the `notifications` table and appears on the app's **Notifications** page, whether or not the email could be sent.

## Choosing a provider

Set `MAIL_PROVIDER` in `server/.env`.

| Value | When to use it |
|---|---|
| `console` (default) | Development. Emails are only printed in the server terminal. Status is saved as `SKIPPED`. |
| `smtp` | Your own computer, or a server that allows SMTP. Works with Gmail, Mailtrap or the college mail server. |
| `brevo` | Hosting on Render's free plan. That plan blocks the SMTP ports (25, 465, 587), so email has to go over HTTPS. Brevo's free plan allows 300 emails a day. |

Also set `MAIL_FROM_NAME` and `MAIL_FROM_EMAIL`. The sender address must be one you control.

### Option A: Brevo (works everywhere, free)

1. Create a free account at brevo.com.
2. Add and verify a sender address (in the Senders section of your account). Brevo emails you a link to click. Without a verified sender, every send fails with a 400 error.
3. Create an API key (in the SMTP & API section; menu names change from time to time).
4. In `.env`:
   ```
   MAIL_PROVIDER=brevo
   BREVO_API_KEY=your_api_key
   MAIL_FROM_EMAIL=the_verified_sender@example.com
   MAIL_FROM_NAME=NITC Room Booking
   ```

Tip: mail sent "from" a free address such as Gmail can land in spam. If the institute's IT team can verify an institute domain with Brevo, deliverability is better.

### Option B: Gmail SMTP (local development only)

1. Turn on 2-step verification for the Google account, then create an **App password**.
2. In `.env`:
   ```
   MAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=the_16_character_app_password
   MAIL_FROM_EMAIL=yourname@gmail.com
   ```

### Option C: Mailtrap (catches emails without delivering them)

Create an Email Testing inbox on Mailtrap and copy its SMTP host, port, username and password into the `SMTP_*` settings with `MAIL_PROVIDER=smtp`. Handy for checking how the emails look.

## Test your setup

Restart the server after editing `.env`. The start-up log prints the provider and warns about missing settings:

```
Email provider: brevo
```

Send yourself a test email:

```powershell
cd server
npm run mail:test -- you@example.com
```

Then trigger the real thing: log in as `faculty@nitc.ac.in`, book a room, and check the inbox of that account's email address. (Seeded addresses are fake, so change a user's email in the database to one you can read, or register a real account and promote it.)

## Retry policy

If sending fails, the server tries up to 3 times, waiting 2 seconds and then 6 seconds. It does not retry errors that cannot fix themselves (wrong API key, unverified sender, invalid address). A failed email never blocks or undoes the booking.

## Notification status values

| Status | Meaning |
|---|---|
| `SENT` | Handed to the email provider |
| `SKIPPED` | Provider is `console`, nothing was sent |
| `FAILED` | All attempts failed. The reason is in the `error` column. |

See recent failures in pgAdmin or psql:

```sql
SELECT id, "userId", type, error, "createdAt"
FROM notifications WHERE status = 'FAILED' ORDER BY id DESC LIMIT 20;
```

## Changing the wording or look

- Event messages: `server/src/services/bookingService.js` and `maintenanceService.js` (search for `notifySafe`).
- Email layout and colours: `server/src/services/emailTemplates.js`.
- Button text and link per event: the `LINKS` table at the top of `server/src/services/notificationService.js`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Status `SKIPPED` | `MAIL_PROVIDER` is still `console`, or the server wasn't restarted |
| Brevo `400` / "sender is invalid" | The `MAIL_FROM_EMAIL` address isn't verified in Brevo |
| Brevo `401` | Wrong or revoked `BREVO_API_KEY` |
| SMTP timeout on Render | Free Render services block SMTP ports. Use `brevo`. |
| Email arrives in spam | Free-address sender. Verify an institute domain, or mark as not spam while testing. |
| Daily limit reached | Brevo free plan is 300 emails a day |
