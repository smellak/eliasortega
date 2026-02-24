import { Router } from "express";
import {
  createEmailRecipientSchema,
  updateEmailRecipientSchema,
} from "../../shared/types";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../middleware/auth";
import { sendTestEmail, sendDailySummary } from "../services/email-service";
import { prisma } from "../db/client";

const router = Router();

router.get("/api/email-recipients", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const recipients = await prisma.emailRecipient.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(recipients);
  } catch (error) {
    console.error("Get email recipients error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/api/email-recipients", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const data = createEmailRecipientSchema.parse(req.body);
    const recipient = await prisma.emailRecipient.create({
      data: {
        email: data.email,
        name: data.name,
        receivesDailySummary: data.receivesDailySummary,
        receivesAlerts: data.receivesAlerts,
        receivesUrgent: data.receivesUrgent,
        active: data.active,
      },
    });
    res.status(201).json(recipient);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Create email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/api/email-recipients/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const data = updateEmailRecipientSchema.parse(req.body);
    const recipient = await prisma.emailRecipient.update({
      where: { id: req.params.id },
      data,
    });
    res.json(recipient);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Recipient not found" });
    }
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("Update email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/api/email-recipients/:id", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    await prisma.emailRecipient.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Recipient not found" });
    }
    console.error("Delete email recipient error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Email Log (ADMIN only)
router.get("/api/email-log", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { limit, offset } = req.query;
    const take = Math.min(parseInt(limit as string) || 50, 200);
    const skip = parseInt(offset as string) || 0;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.emailLog.count(),
    ]);

    res.json({ logs, total, limit: take, offset: skip });
  } catch (error) {
    console.error("Get email log error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send test email (ADMIN only)
router.post("/api/email/test", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Recipient email (to) is required" });
    }

    const success = await sendTestEmail(to);

    if (success) {
      res.json({ success: true, message: "Test email sent successfully" });
    } else {
      res.status(500).json({ success: false, message: "Failed to send test email. Check SMTP configuration." });
    }
  } catch (error: any) {
    console.error("Send test email error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Send daily summary email — defaults to tomorrow, optionally pass a date
router.post("/api/email/send-summary", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : undefined;

    if (date && isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    const sent = await sendDailySummary(targetDate);
    res.json({ success: true, recipientsSent: sent });
  } catch (error: any) {
    console.error("Send summary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
