import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import asyncHandler from '../utils/asyncHandler.js';
import { idParam } from '../utils/helpers.js';
import * as bookings from '../services/bookingService.js';
import { createBookingSchema, modifyBookingSchema, reviewSchema } from '../validators/schemas.js';

const router = Router();
const ah = asyncHandler;

router.use(authenticate);

router.get('/mine', ah(async (req, res) => {
  res.json({ bookings: await bookings.listMine(req.user.id) });
}));

router.get('/pending', authorize('HOD', 'ADMIN'), ah(async (req, res) => {
  res.json({ bookings: await bookings.listPending(req.user) });
}));

router.post('/', validate(createBookingSchema), ah(async (req, res) => {
  const booking = await bookings.createBooking(req.user, req.body);
  res.status(201).json({ booking });
}));

router.get('/:id/alternatives', ah(async (req, res) => {
  res.json({ alternatives: await bookings.alternativesFor(req.user, idParam(req)) });
}));

router.patch('/:id', validate(modifyBookingSchema), ah(async (req, res) => {
  res.json({ booking: await bookings.modifyBooking(req.user, idParam(req), req.body) });
}));

router.patch('/:id/cancel', ah(async (req, res) => {
  res.json({ booking: await bookings.cancelBooking(req.user, idParam(req)) });
}));

router.patch('/:id/approve', authorize('HOD', 'ADMIN'), validate(reviewSchema), ah(async (req, res) => {
  res.json({ booking: await bookings.reviewBooking(req.user, idParam(req), 'APPROVE', req.body.note) });
}));

router.patch('/:id/reject', authorize('HOD', 'ADMIN'), validate(reviewSchema), ah(async (req, res) => {
  res.json({ booking: await bookings.reviewBooking(req.user, idParam(req), 'REJECT', req.body.note) });
}));

export default router;
