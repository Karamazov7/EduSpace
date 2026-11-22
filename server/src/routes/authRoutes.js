import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import authenticate from '../middleware/authenticate.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import * as passwordResets from '../services/passwordResetService.js';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
} from '../validators/authValidators.js';

const router = Router();

router.post('/register', validate(registerSchema), asyncHandler(authController.register));
router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', authenticate, asyncHandler(authController.me));

// Forgot password: the answer is the same whether or not the details matched an account.
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req, res) => {
  await passwordResets.requestReset(req.body);
  res.json({ message: 'If those details match an account, an administrator has been asked to send you a reset link.' });
}));

router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req, res) => {
  await passwordResets.resetPassword(req.body);
  res.json({ message: 'Your password has been changed. You can now log in.' });
}));

export default router;
