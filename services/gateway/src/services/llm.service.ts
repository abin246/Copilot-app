import axios from "axios";
import { listOllamaModels, resolveOllamaModel } from "./ollama-model.service.js";

const OLLAMA_URL = process.env.OLLAMA_API || "http://localhost:11434";

export type LlmStreamOptions = {
  model?: string;
  temperature?: number;
  top_p?: number;
  num_ctx?: number;
  num_predict?: number;
};

export async function streamLLMResponse(
  prompt: string,
  onChunk: (chunk: string) => void,
  options: LlmStreamOptions = {}
): Promise<void> {
  async function startStream(model: string) {
    const opts: Record<string, unknown> = {
      // Slightly larger default to support short conversation history.
      num_ctx: options.num_ctx ?? 2048
    };

    if (options.temperature != null) opts.temperature = options.temperature;
    if (options.top_p != null) opts.top_p = options.top_p;
    if (options.num_predict != null) opts.num_predict = options.num_predict;

    return await axios({
      method: "post",
      url: `${OLLAMA_URL}/api/generate`,
      data: {
        model,
        prompt: prompt,
        stream: true,
        options: opts
      },
      responseType: "stream",
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  let model = options.model || (await resolveOllamaModel());
  let response;
  try {
    response = await startStream(model);
  } catch (err: any) {
    const status = err?.response?.status;
    // Common failure: model name doesn't exist in this Ollama instance.
    if (status === 404) {
      const tags = await listOllamaModels();
      const fallback = tags.find((m) => m && m !== model);
      if (fallback) {
        model = fallback;
        response = await startStream(model);
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  await new Promise<void>((resolve, reject) => {
    response.data.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n");

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          if (parsed.response) {
            onChunk(parsed.response);
          }
        } catch (err) {
          console.error("Ollama parse error:", err);
        }
      }
    });

    response.data.on("end", () => resolve());
    response.data.on("error", (err: unknown) => reject(err));
  });
}
