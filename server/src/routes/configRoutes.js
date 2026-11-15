import { Router } from 'express';
import { bookingRules } from '../utils/helpers.js';

const router = Router();

// Public: opening hours and the latest bookable date, so the pickers match the server's rules.
router.get('/', (req, res) => res.json({ booking: bookingRules() }));

export default router;
