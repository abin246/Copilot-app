import express, { Router } from "express";
import {
  autoMeetingAudioHandler,
  autoMeetingInputHandler,
  autoMeetingStatusHandler
} from "../controllers/meeting-auto.controller.js";

const router = Router();

router.get("/status", autoMeetingStatusHandler);
router.post("/input", autoMeetingInputHandler);
router.post("/audio", express.raw({ type: () => true, limit: "4mb" }), autoMeetingAudioHandler);

export default router;
