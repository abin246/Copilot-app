import type { Request, Response, NextFunction } from "express";
import { listOllamaModels, resolveOllamaModel } from "../services/ollama-model.service.js";

export async function listModelsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const [models, resolved] = await Promise.all([listOllamaModels(), resolveOllamaModel()]);
    res.json({ models, resolved });
  } catch (err) {
    next(err);
  }
}

