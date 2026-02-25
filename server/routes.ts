import { Router } from "express";
import publicRoutes from "./routes/public";
import authRoutes from "./routes/auth";
import providerRoutes from "./routes/providers";
import userRoutes from "./routes/users";
import emailRoutes from "./routes/email";
import slotRoutes from "./routes/slots";
import appointmentRoutes from "./routes/appointments";
import capacityRoutes from "./routes/capacity";
import dockRoutes from "./routes/docks";
import integrationRoutes from "./routes/integration";
import configRoutes from "./routes/config";
import adminChatRoutes from "./routes/admin-chat";

const router = Router();

router.use(publicRoutes);
router.use(authRoutes);
router.use(providerRoutes);
router.use(userRoutes);
router.use(emailRoutes);
router.use(slotRoutes);
router.use(appointmentRoutes);
router.use(capacityRoutes);
router.use(dockRoutes);
router.use(integrationRoutes);
router.use(configRoutes);
router.use(adminChatRoutes);

export default router;
