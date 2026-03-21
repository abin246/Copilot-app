import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("4000"),

  // OpenRouter (optional). When missing, we fall back to Ollama.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().optional().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().optional().default("openai/gpt-4o-mini"),

  // Metadata headers for OpenRouter (optional, but recommended).
  APP_URL: z.string().url().optional().default("http://localhost:4000"),
  APP_NAME: z.string().optional().default("Copilot App"),

  // Ollama (optional overrides; realtime WS uses process.env directly too).
  OLLAMA_API: z.string().url().optional().default("http://localhost:11434"),

  // STT
  STT_API: z.string().url().optional().default("http://localhost:8001/transcribe"),

  // Database (PostgreSQL)
  DATABASE_URL: z.string().optional().default("postgresql://copilot:copilot@localhost:5432/copilot"),
  USE_DATABASE: z.string().optional().default("true"),

  // Authentication
  JWT_SECRET: z.string().optional().default("change-me-in-production"),

  // Storage (file-based fallback)
  MEETINGS_DIR: z.string().optional().default("data/meetings")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
