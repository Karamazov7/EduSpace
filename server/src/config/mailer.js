import nodemailer from 'nodemailer';

let transporter;

// Returns true if an email was sent, false if SMTP is not configured.
export async function sendMail(to, subject, text) {
  if (!process.env.SMTP_HOST) {
    console.log(`[email skipped - SMTP not configured] to=${to} | ${subject}`);
    return false;
  }
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
  return true;
}
