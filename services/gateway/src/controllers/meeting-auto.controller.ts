import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getAutoMeetingStatus, submitAutoMeetingAudio, submitAutoMeetingInput } from "../services/meeting-auto.service.js";

const responseModeSchema = z.enum(["auto", "concise", "detailed", "action_items", "rewrite"]);

const inputSchema = z.object({
  text: z.string().min(1),
  appId: z.enum(["zoom", "teams", "google_meet"]).optional(),
  responseMode: responseModeSchema.optional(),
  customInstruction: z.string().max(1000).optional()
});

const appIdSchema = z.enum(["zoom", "teams", "google_meet"]);

export async function autoMeetingStatusHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(getAutoMeetingStatus());
  } catch (err) {
    next(err);
  }
}

export async function autoMeetingInputHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = inputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.format() });
    }

    const result = await submitAutoMeetingInput({
      text: parsed.data.text,
      ...(parsed.data.appId ? { appId: parsed.data.appId } : {}),
      ...(parsed.data.responseMode ? { responseMode: parsed.data.responseMode } : {}),
      ...(parsed.data.customInstruction ? { customInstruction: parsed.data.customInstruction } : {})
    });
    if (!result.ok) {
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function autoMeetingAudioHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body;
    const audio = Buffer.isBuffer(body) ? body : Buffer.from([]);

    const rawAppId = typeof req.query.appId === "string" ? req.query.appId : undefined;
    const rawMode = typeof req.query.responseMode === "string" ? req.query.responseMode : undefined;
    const rawCustomInstruction =
      typeof req.query.customInstruction === "string" ? req.query.customInstruction : undefined;

    let appId: "zoom" | "teams" | "google_meet" | undefined;
    let responseMode: "auto" | "concise" | "detailed" | "action_items" | "rewrite" | undefined;
    let customInstruction: string | undefined;

    if (rawAppId) {
      const parsed = appIdSchema.safeParse(rawAppId);
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid_appId" });
      }
      appId = parsed.data;
    }
    if (rawMode) {
      const parsed = responseModeSchema.safeParse(rawMode);
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid_responseMode" });
      }
      responseMode = parsed.data;
    }
    if (rawCustomInstruction) {
      customInstruction = rawCustomInstruction.slice(0, 1000);
    }

    const result = await submitAutoMeetingAudio({
      audio,
      ...(appId ? { appId } : {}),
      ...(responseMode ? { responseMode } : {}),
      ...(customInstruction ? { customInstruction } : {})
    });

    if (!result.ok) {
      if (result.error === "empty_transcript") return res.status(202).json(result);
      return res.status(409).json(result);
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}
