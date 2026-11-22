import { z } from 'zod';

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt's limit
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z.object({
  collegeId: z.string().trim().min(3).max(30),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: passwordRule,
  // Stored in capitals so "cse" and "CSE" count as the same department
  department: z.string().trim().toUpperCase().min(2, 'Department is required').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  collegeId: z.string().trim().min(3).max(30),
});

export const resetPasswordSchema = z.object({
  token: z.string().length(64, 'This reset link is not valid'),
  password: passwordRule,
});
