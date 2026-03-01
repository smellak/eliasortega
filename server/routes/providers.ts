import { Router } from "express";
import {
  createProviderSchema,
  updateProviderSchema,
} from "../../shared/types";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../middleware/auth";
import { logAudit, computeChanges } from "../services/audit-service";
import { prisma } from "../db/client";
import { z } from "zod";

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  role: z.string().nullish(),
});

router.get("/api/providers", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const providers = await prisma.provider.findMany({
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: "asc" },
    });
    res.json(providers);
  } catch (error) {
    console.error("Get providers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/api/providers/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const provider = await prisma.provider.findUnique({
      where: { id: req.params.id },
      include: { contacts: true, _count: { select: { contacts: true } } },
    });
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    res.json(provider);
  } catch (error) {
    console.error("Get provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/providers", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = createProviderSchema.parse(req.body);

    const provider = await prisma.provider.create({
      data,
    });

    logAudit({
      entityType: "PROVIDER",
      entityId: provider.id,
      action: "CREATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: data as Record<string, unknown>,
    }).catch(() => {});

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

    const before = await prisma.provider.findUnique({ where: { id: req.params.id } });

    const provider = await prisma.provider.update({
      where: { id: req.params.id },
      data,
      include: { contacts: true },
    });

    logAudit({
      entityType: "PROVIDER",
      entityId: provider.id,
      action: "UPDATE",
      actorType: "USER",
      actorId: req.user?.id,
      changes: before ? computeChanges(before as any, provider as any) : (data as Record<string, unknown>),
    }).catch(() => {});

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

    logAudit({
      entityType: "PROVIDER",
      entityId: req.params.id,
      action: "DELETE",
      actorType: "USER",
      actorId: req.user?.id,
    }).catch(() => {});

    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Provider not found" });
    }
    console.error("Delete provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Provider Contacts CRUD ---

router.post("/api/providers/:id/contacts", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = contactSchema.parse(req.body);
    const contact = await prisma.providerContact.create({
      data: { ...data, providerId: req.params.id },
    });
    res.status(201).json(contact);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    console.error("Create contact error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/providers/:providerId/contacts/:contactId", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const data = contactSchema.partial().parse(req.body);
    const contact = await prisma.providerContact.update({
      where: { id: req.params.contactId },
      data,
    });
    res.json(contact);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Contact not found" });
    }
    console.error("Update contact error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/providers/:providerId/contacts/:contactId", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    await prisma.providerContact.delete({
      where: { id: req.params.contactId },
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Contact not found" });
    }
    console.error("Delete contact error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
