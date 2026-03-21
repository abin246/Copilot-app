import { Router } from "express";
import { executeToolsHandler } from "../controllers/tools.controller.js";

const router = Router();

router.post("/execute", executeToolsHandler);

export default router;

