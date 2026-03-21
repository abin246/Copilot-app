import type { Request, Response, NextFunction } from "express";
import { generateCompletion } from "../services/openai.service.js";

export async function copilotHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const output = await generateCompletion(prompt);

    res.json({ response: output });
  } catch (error) {
    next(error);
  }
}