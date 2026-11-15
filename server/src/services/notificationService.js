import prisma from "../config/prisma.js";
import { sendMail } from "../config/mailer.js";

// Saves the notification (FR-046), then tries to email it (FR-043/044/045).
export async function notify(userId, type, subject, message) {
  const record = await prisma.notification.create({
    data: { userId, type, subject, message },
  });
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const sent = await sendMail(user.email, subject, message);
    await prisma.notification.update({
      where: { id: record.id },
      data: sent
        ? { status: "SENT", sentAt: new Date() }
        : { status: "SKIPPED" },
    });
  } catch (err) {
    await prisma.notification.update({
      where: { id: record.id },
      data: { status: "FAILED", error: String(err.message).slice(0, 300) },
    });
  }
}

// Fire-and-forget: a failed email must never fail the booking request.
export const notifySafe = (...args) =>
  notify(...args).catch((err) =>
    console.error("notification failed:", err.message),
  );

export const listForUser = (userId) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

export const broadcastSafe = (type, subject, message) =>
  prisma.broadcast
    .create({ data: { type, subject, message } })
    .catch((err) => console.error("campus update failed:", err.message));

export const listBroadcasts = () =>
  prisma.broadcast.findMany({
    where: {
      createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
