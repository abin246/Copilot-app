import { Router } from "express";
import { listMeetingsHandler, readMeetingHandler } from "../controllers/meeting.controller.js";

const router = Router();

router.get("/", listMeetingsHandler);
router.get("/:sessionId", readMeetingHandler);

export default router;

