import { Router } from "express";
import authRoutes from "./authRoutes.js";
import roomRoutes from "./roomRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import maintenanceRoutes from "./maintenanceRoutes.js";
import userRoutes from "./userRoutes.js";
import notificationRoutes from "./notificationRoutes.js";
import reportRoutes from "./reportRoutes.js";
import configRoutes from "./configRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/rooms", roomRoutes);
router.use("/bookings", bookingRoutes);
router.use("/maintenance", maintenanceRoutes);
router.use("/users", userRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reports", reportRoutes);
router.use("/config", configRoutes);

export default router;
