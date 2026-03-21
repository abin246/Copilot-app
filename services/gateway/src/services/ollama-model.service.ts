import axios from "axios";
import { readFile } from "node:fs/promises";

const OLLAMA_URL = process.env.OLLAMA_API || "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await axios.get(`${OLLAMA_URL}/api/tags`, {
      headers: { "Content-Type": "application/json" }
    });

    const models = (res.data?.models ?? []) as Array<{ name?: unknown }>;
    return models.map((m) => String(m.name || "")).filter(Boolean);
  } catch {
    return [];
  }
}

export async function resolveOllamaModel(): Promise<string> {
  const modelFile = process.env.OLLAMA_MODEL_FILE;

  // Prefer the compose-provisioned model file when present.
  if (modelFile) {
    try {
      const model = (await readFile(modelFile, "utf8")).trim();
      if (model) return model;
    } catch {
      // ignore and fall back
    }
  }

  if (process.env.OLLAMA_MODEL) return process.env.OLLAMA_MODEL;

  const tags = await listOllamaModels();
  if (tags[0]) return tags[0];

  return DEFAULT_OLLAMA_MODEL;
}
