import { Router } from "express";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import { getPredictionAccuracy, getProviderProfiles } from "../services/analytics-service";

const router = Router();

// GET /api/analytics/prediction-accuracy
router.get("/api/analytics/prediction-accuracy", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const { from, to, category } = req.query;
    const results = await getPredictionAccuracy({
      from: from as string | undefined,
      to: to as string | undefined,
      category: category as string | undefined,
    });
    res.json(results);
  } catch (error) {
    console.error("Prediction accuracy error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/analytics/provider-profiles
router.get("/api/analytics/provider-profiles", authenticateToken, requireRole("ADMIN", "PLANNER"), async (req: AuthRequest, res) => {
  try {
    const results = await getProviderProfiles();
    res.json(results);
  } catch (error) {
    console.error("Provider profiles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
