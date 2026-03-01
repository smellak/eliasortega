import { Router } from "express";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { getSchedulingRules, updateSchedulingRules } from "../services/scheduling-rules";

const router = Router();

// GET /api/scheduling-rules — returns all rules with their config
router.get("/api/scheduling-rules", authenticateToken, requireRole("ADMIN", "PLANNER"), async (_req: AuthRequest, res) => {
  try {
    const rules = await getSchedulingRules();
    res.json(rules);
  } catch (error) {
    console.error("Get scheduling rules error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/scheduling-rules — partial update of rules
router.put("/api/scheduling-rules", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res) => {
  try {
    const updated = await updateSchedulingRules(req.body);
    res.json(updated);
  } catch (error) {
    console.error("Update scheduling rules error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
