import { Router } from "express";
import { authenticateToken, requireRole, type AuthRequest } from "../middleware/auth";

const router = Router();

router.post(
  "/api/admin-chat/message",
  authenticateToken,
  requireRole("ADMIN", "PLANNER"),
  async (req: AuthRequest, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message are required" });
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const { adminChat } = await import("../agent/admin-orchestrator");

      for await (const chunk of adminChat(sessionId, message)) {
        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("[ADMIN-CHAT] Error:", error.message);

      const errorChunk = JSON.stringify({
        type: "error",
        content: "Lo siento, ha ocurrido un error. Inténtalo de nuevo.",
      });
      res.write(`data: ${errorChunk}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
);

export default router;
