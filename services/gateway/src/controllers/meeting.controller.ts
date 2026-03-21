import type { Request, Response, NextFunction } from "express";
import { meetingStore } from "../services/meeting-store.singleton.js";

export async function listMeetingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meetings = await meetingStore.listMeetings();
    res.json({ meetings });
  } catch (err) {
    next(err);
  }
}

export async function readMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = (req.params as any).sessionId as string | string[] | undefined;
    const sessionId = Array.isArray(raw) ? raw[0] : raw;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    const events = await meetingStore.readMeeting(sessionId);
    res.json({ sessionId, events });
  } catch (err) {
    next(err);
  }
}

