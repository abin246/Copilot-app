import { Router } from "express";
import { copilotHandler } from "../controllers/copilot.controller.js";

const router = Router();

router.post("/", copilotHandler);

export default router;