import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  loginSchema,
  createProviderSchema,
  updateProviderSchema,
  createCapacityShiftSchema,
  updateCapacityShiftSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  upsertAppointmentSchema,
  AuthResponse,
  UserResponse,
} from "../shared/types";
import { authenticateToken, requireRole, generateToken, AuthRequest } from "./middleware/auth";
import { capacityValidator } from "./services/capacity-validator";

const prisma = new PrismaClient();
const router = Router();

// Health check
router.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Authentication
router.post("/api/auth/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };

    res.json(response);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user
router.get("/api/auth/me", authenticateToken, (req: AuthRequest, res) => {
  res.json(req.user);
});

// Providers
router.get("/api/providers", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { name: "asc" },
    });
    res.json(providers);
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/providers", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createProviderSchema.parse(req.body);
    
    const provider = await prisma.provider.create({
      data,
    });

    res.status(201).json(provider);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Provider name already exists" });
    }
    console.error("Create provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/providers/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateProviderSchema.parse(req.body);
    
    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data,
    });

    res.json(provider);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Provider not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Provider name already exists" });
    }
    console.error("Update provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/providers/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.provider.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Provider not found" });
    }
    console.error("Delete provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Capacity Shifts
router.get("/api/capacity-shifts", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    
    const where: any = {};
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ endUtc: { gte: new Date(from as string) } });
      if (to) where.AND.push({ startUtc: { lte: new Date(to as string) } });
    }

    const shifts = await prisma.capacityShift.findMany({
      where,
      orderBy: { startUtc: "asc" },
    });

    res.json(shifts);
  } catch (error) {
    console.error("Get capacity shifts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/capacity-shifts", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createCapacityShiftSchema.parse(req.body);
    
    const shift = await prisma.capacityShift.create({
      data: {
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workers: data.workers,
        forklifts: data.forklifts,
        docks: data.docks,
      },
    });

    res.status(201).json(shift);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/capacity-shifts/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateCapacityShiftSchema.parse(req.body);
    
    const updateData: any = {};
    if (data.start) updateData.startUtc = new Date(data.start);
    if (data.end) updateData.endUtc = new Date(data.end);
    if (data.workers !== undefined) updateData.workers = data.workers;
    if (data.forklifts !== undefined) updateData.forklifts = data.forklifts;
    if (data.docks !== undefined) updateData.docks = data.docks;

    const shift = await prisma.capacityShift.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(shift);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Capacity shift not found" });
    }
    console.error("Update capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/capacity-shifts/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.capacityShift.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Capacity shift not found" });
    }
    console.error("Delete capacity shift error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Appointments
router.get("/api/appointments", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { from, to, providerId } = req.query;
    
    const where: any = {};
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ endUtc: { gte: new Date(from as string) } });
      if (to) where.AND.push({ startUtc: { lte: new Date(to as string) } });
    }
    if (providerId) {
      where.providerId = providerId as string;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { startUtc: "asc" },
    });

    res.json(appointments);
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/appointments", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createAppointmentSchema.parse(req.body);
    
    // Validate capacity
    const conflict = await capacityValidator.validateAppointment({
      startUtc: new Date(data.start),
      endUtc: new Date(data.end),
      workMinutesNeeded: data.workMinutesNeeded,
      forkliftsNeeded: data.forkliftsNeeded,
    });

    if (conflict) {
      return res.status(409).json({ error: "Capacity conflict", conflict });
    }

    const appointment = await prisma.appointment.create({
      data: {
        providerId: data.providerId,
        providerName: data.providerName,
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
        goodsType: data.goodsType,
        units: data.units,
        lines: data.lines,
        deliveryNotesCount: data.deliveryNotesCount,
        externalRef: data.externalRef,
      },
    });

    res.status(201).json(appointment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "External reference already exists" });
    }
    console.error("Create appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/appointments/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = updateAppointmentSchema.parse(req.body);
    
    // Build update data
    const updateData: any = {};
    if (data.providerId !== undefined) updateData.providerId = data.providerId;
    if (data.providerName) updateData.providerName = data.providerName;
    if (data.start) updateData.startUtc = new Date(data.start);
    if (data.end) updateData.endUtc = new Date(data.end);
    if (data.workMinutesNeeded !== undefined) updateData.workMinutesNeeded = data.workMinutesNeeded;
    if (data.forkliftsNeeded !== undefined) updateData.forkliftsNeeded = data.forkliftsNeeded;
    if (data.goodsType !== undefined) updateData.goodsType = data.goodsType;
    if (data.units !== undefined) updateData.units = data.units;
    if (data.lines !== undefined) updateData.lines = data.lines;
    if (data.deliveryNotesCount !== undefined) updateData.deliveryNotesCount = data.deliveryNotesCount;
    if (data.externalRef !== undefined) updateData.externalRef = data.externalRef;

    // Get current appointment to merge with updates for validation
    const current = await prisma.appointment.findUnique({
      where: { id: req.params.id },
    });

    if (!current) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Validate capacity with updated values
    const conflict = await capacityValidator.validateAppointment({
      id: req.params.id,
      startUtc: updateData.startUtc || current.startUtc,
      endUtc: updateData.endUtc || current.endUtc,
      workMinutesNeeded: updateData.workMinutesNeeded ?? current.workMinutesNeeded,
      forkliftsNeeded: updateData.forkliftsNeeded ?? current.forkliftsNeeded,
    });

    if (conflict) {
      return res.status(409).json({ error: "Capacity conflict", conflict });
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(appointment);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "External reference already exists" });
    }
    console.error("Update appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/appointments/:id", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.appointment.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Appointment not found" });
    }
    console.error("Delete appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get real-time capacity for a specific minute
router.get("/api/capacity/at-minute", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { minute } = req.query;
    
    if (!minute) {
      return res.status(400).json({ error: "Minute parameter required" });
    }

    const capacity = await capacityValidator.getCapacityAtMinute(new Date(minute as string));
    res.json(capacity);
  } catch (error) {
    console.error("Get capacity at minute error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Integration endpoints (for n8n, etc.)
router.post("/api/integration/appointments/upsert", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const data = upsertAppointmentSchema.parse(req.body);
    
    // Check if appointment exists by externalRef
    const existing = await prisma.appointment.findUnique({
      where: { externalRef: data.externalRef },
    });

    if (existing) {
      // Update existing
      const conflict = await capacityValidator.validateAppointment({
        id: existing.id,
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
      });

      if (conflict) {
        return res.status(409).json({ error: "Capacity conflict", conflict });
      }

      const appointment = await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          providerId: data.providerId,
          providerName: data.providerName,
          startUtc: new Date(data.start),
          endUtc: new Date(data.end),
          workMinutesNeeded: data.workMinutesNeeded,
          forkliftsNeeded: data.forkliftsNeeded,
          goodsType: data.goodsType,
          units: data.units,
          lines: data.lines,
          deliveryNotesCount: data.deliveryNotesCount,
        },
      });

      return res.json({ action: "updated", appointment });
    }

    // Create new
    const conflict = await capacityValidator.validateAppointment({
      startUtc: new Date(data.start),
      endUtc: new Date(data.end),
      workMinutesNeeded: data.workMinutesNeeded,
      forkliftsNeeded: data.forkliftsNeeded,
    });

    if (conflict) {
      return res.status(409).json({ error: "Capacity conflict", conflict });
    }

    const appointment = await prisma.appointment.create({
      data: {
        providerId: data.providerId,
        providerName: data.providerName,
        startUtc: new Date(data.start),
        endUtc: new Date(data.end),
        workMinutesNeeded: data.workMinutesNeeded,
        forkliftsNeeded: data.forkliftsNeeded,
        goodsType: data.goodsType,
        units: data.units,
        lines: data.lines,
        deliveryNotesCount: data.deliveryNotesCount,
        externalRef: data.externalRef,
      },
    });

    res.status(201).json({ action: "created", appointment });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Upsert appointment error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/integration/appointments/by-external-ref/:externalRef", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { externalRef: req.params.externalRef },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json(appointment);
  } catch (error) {
    console.error("Get appointment by external ref error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Users (admin only)
router.get("/api/users", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { email: "asc" },
    });

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/users", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(user);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/users/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { email, role } = req.body;

    const updateData: any = {};
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(user);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/users/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
