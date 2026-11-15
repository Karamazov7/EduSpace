import { Router } from "express";
import prisma from "../config/prisma.js";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import validate from "../middleware/validate.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/AppError.js";
import {
  idParam,
  assertInterval,
  assertWithinBookingRules,
} from "../utils/helpers.js";
import { searchRooms } from "../services/availabilityService.js";
import { broadcast } from "../config/socket.js";
import {
  roomSchema,
  roomUpdateSchema,
  roomStatusSchema,
  equipmentSchema,
  equipmentUpdateSchema,
  searchSchema,
} from "../validators/schemas.js";

const router = Router();
const ah = asyncHandler;
const MANAGERS = ["ADMIN", "LAB_INCHARGE"];

router.use(authenticate);

// Admins manage every room. A lab in-charge manages only the labs owned by their own department (FR-010).
const assertCanManage = (user, type, department) => {
  if (user.role !== "LAB_INCHARGE") return;
  if (!user.department) {
    throw new AppError(
      403,
      "Your account has no department yet. Ask an admin to set it.",
    );
  }
  if (type !== "LAB")
    throw new AppError(403, "Lab in-charges can only manage laboratories");
  if (department !== user.department) {
    throw new AppError(403, "This lab belongs to another department");
  }
};

const getRoom = async (id) => {
  const room = await prisma.room.findUnique({
    where: { id },
    include: { equipment: true },
  });
  if (!room) throw new AppError(404, "Room not found");
  return room;
};

// FR-012 to FR-016. Must be declared before '/:id'.
router.get(
  "/search",
  validate(searchSchema, "query"),
  ah(async (req, res) => {
    const { start, end, type, capacity } = req.validated;
    assertInterval(start, end);
    assertWithinBookingRules(start, end);
    res.json({ rooms: await searchRooms({ start, end, type, capacity }) });
  }),
);

router.get(
  "/",
  ah(async (req, res) => {
    const canSeeInactive =
      MANAGERS.includes(req.user.role) || req.user.role === "MAINTENANCE_STAFF";
    const rooms = await prisma.room.findMany({
      where:
        canSeeInactive && req.query.includeInactive === "true"
          ? {}
          : { isActive: true },
      include: { equipment: true },
      orderBy: { name: "asc" },
    });
    res.json({ rooms });
  }),
);

router.get(
  "/:id",
  ah(async (req, res) => {
    res.json({ room: await getRoom(idParam(req)) });
  }),
);

// FR-007, FR-008
router.post(
  "/",
  authorize(...MANAGERS),
  validate(roomSchema),
  ah(async (req, res) => {
    // A lab in-charge's new labs always belong to their own department.
    if (req.user.role === "LAB_INCHARGE")
      req.body.department = req.user.department;
    assertCanManage(req.user, req.body.type, req.body.department);
    try {
      const room = await prisma.room.create({ data: req.body });
      res.status(201).json({ room });
    } catch (err) {
      if (err.code === "P2002")
        throw new AppError(409, "A room with this name already exists");
      throw err;
    }
  }),
);

router.put(
  "/:id",
  authorize(...MANAGERS),
  validate(roomUpdateSchema),
  ah(async (req, res) => {
    const existing = await getRoom(idParam(req));
    assertCanManage(req.user, existing.type, existing.department);
    if (req.user.role === "LAB_INCHARGE") {
      delete req.body.department; // only admins move a room between departments
      if (req.body.type && req.body.type !== "LAB") {
        throw new AppError(403, "Lab in-charges can only manage laboratories");
      }
    }
    try {
      const room = await prisma.room.update({
        where: { id: existing.id },
        data: req.body,
      });
      broadcast("availability:changed");
      res.json({ room });
    } catch (err) {
      if (err.code === "P2002")
        throw new AppError(409, "A room with this name already exists");
      throw err;
    }
  }),
);

// Deactivate instead of deleting, so booking history stays intact.
router.delete(
  "/:id",
  authorize(...MANAGERS),
  ah(async (req, res) => {
    const existing = await getRoom(idParam(req));
    assertCanManage(req.user, existing.type, existing.department);
    const room = await prisma.room.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    broadcast("availability:changed");
    res.json({ room });
  }),
);

// FR-011: operational status, which maintenance staff may also change.
router.patch(
  "/:id/status",
  authorize(...MANAGERS, "MAINTENANCE_STAFF"),
  validate(roomStatusSchema),
  ah(async (req, res) => {
    const existing = await getRoom(idParam(req));
    assertCanManage(req.user, existing.type, existing.department);
    const room = await prisma.room.update({
      where: { id: existing.id },
      data: { status: req.body.status },
    });
    broadcast("availability:changed");
    res.json({ room });
  }),
);

// FR-009: equipment
router.post(
  "/:id/equipment",
  authorize(...MANAGERS),
  validate(equipmentSchema),
  ah(async (req, res) => {
    const room = await getRoom(idParam(req));
    assertCanManage(req.user, room.type, room.department);
    const equipment = await prisma.equipment.create({
      data: { ...req.body, roomId: room.id },
    });
    res.status(201).json({ equipment });
  }),
);

const getEquipmentWithRoom = async (id) => {
  const item = await prisma.equipment.findUnique({
    where: { id },
    include: { room: true },
  });
  if (!item) throw new AppError(404, "Equipment not found");
  return item;
};

router.put(
  "/equipment/:eid",
  authorize(...MANAGERS),
  validate(equipmentUpdateSchema),
  ah(async (req, res) => {
    const item = await getEquipmentWithRoom(idParam(req, "eid"));
    assertCanManage(req.user, item.room.type, item.room.department);
    const equipment = await prisma.equipment.update({
      where: { id: item.id },
      data: req.body,
    });
    res.json({ equipment });
  }),
);

router.delete(
  "/equipment/:eid",
  authorize(...MANAGERS),
  ah(async (req, res) => {
    const item = await getEquipmentWithRoom(idParam(req, "eid"));
    assertCanManage(req.user, item.room.type, item.room.department);
    await prisma.equipment.delete({ where: { id: item.id } });
    res.status(204).end();
  }),
);

export default router;
