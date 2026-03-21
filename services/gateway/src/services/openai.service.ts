import OpenAI from "openai";
import { env } from "../config/env.js";
import axios from "axios";
import { resolveOllamaModel } from "./ollama-model.service.js";

function createOpenRouterClient() {
  return new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": env.APP_URL,
      "X-Title": env.APP_NAME
    }
  });
}

export async function generateCompletion(prompt: string): Promise<string> {
  // Prefer OpenRouter if configured; otherwise fall back to Ollama for local-only operation.
  if (env.OPENROUTER_API_KEY) {
    const client = createOpenRouterClient();
    const response = await client.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a helpful AI coding assistant."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || "";
  }

  const model = await resolveOllamaModel();
  const res = await axios.post(
    `${env.OLLAMA_API}/api/generate`,
    { model, prompt, stream: false },
    { headers: { "Content-Type": "application/json" } }
  );

  return (res.data?.response ?? "").toString();
}
