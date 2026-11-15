import { z } from "zod";

const ROLES = [
  "STUDENT",
  "CLASS_REPRESENTATIVE",
  "FACULTY",
  "ADMIN",
  "LAB_INCHARGE",
  "HOD",
  "TIMETABLE_COORDINATOR",
  "MAINTENANCE_STAFF",
  "MANAGEMENT",
];
const int = (min = 1, max = 100000) =>
  z.coerce.number().int().min(min).max(max);

// ---- rooms & equipment
const roomBase = z.object({
  name: z.string().trim().min(1).max(50),
  type: z.enum(["CLASSROOM", "LAB"]),
  capacity: int(1, 1000),
  building: z.string().trim().max(100).optional(),
  department: z
    .string()
    .trim()
    .toUpperCase()
    .max(100)
    .transform((v) => v || null)
    .nullable()
    .optional(),
  facilities: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  status: z.enum(["OPERATIONAL", "NON_OPERATIONAL"]).optional(),
});
export const roomSchema = roomBase;
export const roomUpdateSchema = roomBase
  .partial()
  .extend({ isActive: z.boolean().optional() });
export const roomStatusSchema = z.object({
  status: z.enum(["OPERATIONAL", "NON_OPERATIONAL"]),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  quantity: int(1, 10000).optional(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]).optional(),
});
export const equipmentUpdateSchema = equipmentSchema.partial();

export const searchSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
  type: z.enum(["CLASSROOM", "LAB"]).optional(),
  capacity: int(1, 1000).optional(),
});

// ---- bookings
export const createBookingSchema = z.object({
  roomId: int(),
  classStrength: int(1, 1000),
  purpose: z.string().trim().min(3).max(300),
  start: z.coerce.date(),
  end: z.coerce.date(),
});
export const modifyBookingSchema = createBookingSchema.partial();
export const reviewSchema = z.object({
  note: z.string().trim().max(300).optional(),
});

// ---- maintenance
export const maintenanceSchema = z.object({
  roomId: int(),
  reason: z.string().trim().min(3).max(300),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

// ---- users (admin)
export const userUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  // null clears the department; text is stored in capitals
  department: z.string().trim().toUpperCase().max(100).nullable().optional(),
});

// ---- reports
export const reportSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const roleChangeSchema = z.object({
  role: z.enum(["STUDENT", "CLASS_REPRESENTATIVE", "FACULTY"]),
});
