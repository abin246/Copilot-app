import { Router } from "express";
import { listModelsHandler } from "../controllers/models.controller.js";

const router = Router();

router.get("/", listModelsHandler);

export default router;

