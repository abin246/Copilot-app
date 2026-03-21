import WebSocket from "ws"
import axios from "axios"
import { streamLLMResponse } from "./llm.service.js"
import type { LlmStreamOptions } from "./llm.service.js"
import { randomUUID } from "node:crypto"
import { meetingStore } from "./meeting-store.singleton.js"
import { planFromTranscript } from "../agents/planner.agent.js"

const STT_API = process.env.STT_API || "http://localhost:8001/transcribe"

// 16 kHz mono, 2 seconds per transcription window
const SAMPLE_RATE = 16000
const BYTES_PER_SAMPLE = 2
const WINDOW_SECONDS = 2
const WINDOW_SAMPLES = SAMPLE_RATE * WINDOW_SECONDS

export function handleRealtimeSession(ws: WebSocket) {
  let pcmBuffer = Buffer.alloc(0)
  let processing = false
  let llmBusy = false
  const llmQueue: string[] = []
  const history: Array<{ role: "user" | "assistant"; text: string }> = []
  const settings: SessionSettings = { temperature: 0.2, style: "balanced" }
  const sessionId = randomUUID()

  // Tell the client which meeting session this websocket represents.
  try {
    ws.send(JSON.stringify({ type: "session", data: sessionId }))
  } catch {
    // ignore send failures
  }

  void meetingStore.appendMeetingEvent(sessionId, { ts: Date.now(), type: "session", sessionId })

  const windowBytes = WINDOW_SAMPLES * BYTES_PER_SAMPLE

  ws.on("message", (data: any) => {
    // Support JSON control messages in addition to raw PCM audio.
    // This is handy for text-based testing (and avoids STT issues when debugging).
    const maybeText = coerceUtf8String(data)
    if (maybeText) {
      try {
        const msg = JSON.parse(maybeText)
        if (msg && typeof msg === "object") {
          if (msg.type === "text") {
            const text = String(msg.data || "").trim()
            if (text) void processTranscript(text)
            return
          }

          if (msg.type === "settings") {
            applySettings(settings, msg.data)
            return
          }

          if (msg.type === "reset") {
            resetSession()
            return
          }
        }
      } catch {
        // Not JSON; fall through to treat as audio bytes.
      }
    }

    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
    pcmBuffer = Buffer.concat([pcmBuffer, buf])
    void processIfReady()
  })

  async function processTranscript(transcript: string): Promise<void> {
    // Echo transcript window to UI.
    try {
      ws.send(JSON.stringify({ type: "transcript", data: transcript }))
    } catch {
      // ignore send failures
    }

    void meetingStore.appendMeetingEvent(sessionId, { ts: Date.now(), type: "transcript", text: transcript })

    const plan = planFromTranscript(transcript)
    if (plan) {
      try {
        ws.send(JSON.stringify({ type: "plan", data: JSON.stringify(plan) }))
      } catch {
        // ignore send failures
      }
    }

    if (!transcript) return

    llmQueue.push(transcript)
    void drainLlmQueue()
  }

  async function drainLlmQueue(): Promise<void> {
    if (llmBusy) return
    const nextPrompt = llmQueue.shift()
    if (!nextPrompt) return

    llmBusy = true

    try {
      // Maintain a short in-memory chat history so answers feel coherent.
      history.push({ role: "user", text: nextPrompt })
      trimHistory(history, 16)

      try {
        ws.send(JSON.stringify({ type: "ai_begin", data: { model: settings.model || "auto" } }))
      } catch {
        // ignore send failures
      }

      const prompt = buildPrompt(history, settings)
      let assistantText = ""

      const llmOptions: LlmStreamOptions = {}
      if (settings.model) llmOptions.model = settings.model
      if (settings.temperature != null) llmOptions.temperature = settings.temperature
      if (settings.top_p != null) llmOptions.top_p = settings.top_p
      if (settings.num_ctx != null) llmOptions.num_ctx = settings.num_ctx

      await streamLLMResponse(prompt, (chunk) => {
        assistantText += chunk
        try {
          ws.send(JSON.stringify({ type: "ai", data: chunk }))
        } catch {
          // ignore send failures (socket may be closing)
        }
        void meetingStore.appendMeetingEvent(sessionId, { ts: Date.now(), type: "ai", text: chunk })
      }, llmOptions)

      history.push({ role: "assistant", text: assistantText.trim() })
      trimHistory(history, 16)
    } catch (err) {
      console.error("LLM error:", err)
      void meetingStore.appendMeetingEvent(sessionId, { ts: Date.now(), type: "error", message: "LLM request failed" })
      try {
        const anyErr = err as any
        const status = anyErr?.response?.status
        const details = anyErr?.response?.data?.error || anyErr?.message
        ws.send(
          JSON.stringify({
            type: "error",
            data: `LLM request failed${status ? ` (HTTP ${status})` : ""}${details ? `: ${details}` : ""}`
          })
        )
      } catch {
        // ignore send failures
      }
    } finally {
      try {
        ws.send(JSON.stringify({ type: "ai_end", data: null }))
      } catch {
        // ignore send failures
      }

      llmBusy = false
      if (llmQueue.length > 0) void drainLlmQueue()
    }
  }

  async function processIfReady(): Promise<void> {
    if (processing) return
    if (pcmBuffer.length < windowBytes) return

    processing = true

    // Consume exactly one window at a time to avoid overlapping STT requests
    // (ws "message" handlers do not await async listeners).
    const pcm = pcmBuffer.subarray(0, windowBytes)
    pcmBuffer = pcmBuffer.subarray(windowBytes)

    try {
      const res = await axios.post(STT_API, pcm, {
        headers: { "Content-Type": "application/octet-stream" }
      })

      const transcript = (res.data.text ?? "").toString().trim()

      await processTranscript(transcript)
    } catch (err) {
      console.error("STT error:", err)
      void meetingStore.appendMeetingEvent(sessionId, { ts: Date.now(), type: "error", message: "STT request failed" })
      try {
        ws.send(JSON.stringify({ type: "error", data: "STT request failed" }))
      } catch {
        // ignore send failures (socket may be closing)
      }
    } finally {
      processing = false
      if (pcmBuffer.length >= windowBytes) void processIfReady()
    }
  }

  function resetSession() {
    pcmBuffer = Buffer.alloc(0)
    processing = false
    llmQueue.length = 0
    history.length = 0
  }
}

function coerceUtf8String(data: unknown): string | null {
  if (!data) return null
  if (typeof data === "string") return data
  if (Buffer.isBuffer(data)) {
    // Avoid blowing up on random binary audio; only treat it as text if it looks like JSON.
    const head = data.subarray(0, Math.min(64, data.length)).toString("utf8").trimStart()
    if (head.startsWith("{") || head.startsWith("[")) return data.toString("utf8")
    return null
  }
  return null
}

type SessionSettings = {
  model?: string;
  temperature?: number;
  top_p?: number;
  num_ctx?: number;
  style?: "balanced" | "precise" | "creative";
  systemPrompt?: string;
};

function applySettings(target: SessionSettings, incoming: unknown) {
  if (!incoming || typeof incoming !== "object") return

  const src = incoming as Record<string, unknown>

  if (typeof src.model === "string") {
    const m = src.model.trim()
    if (m) target.model = m
    else delete target.model
  }
  if (typeof src.temperature === "number" && Number.isFinite(src.temperature)) target.temperature = src.temperature
  if (typeof src.top_p === "number" && Number.isFinite(src.top_p)) target.top_p = src.top_p
  if (typeof src.num_ctx === "number" && Number.isFinite(src.num_ctx)) target.num_ctx = Math.max(256, Math.trunc(src.num_ctx))
  if (src.style === "balanced" || src.style === "precise" || src.style === "creative") target.style = src.style
  if (typeof src.systemPrompt === "string") target.systemPrompt = src.systemPrompt
}

function trimHistory(history: Array<{ role: "user" | "assistant"; text: string }>, maxMessages: number) {
  if (history.length <= maxMessages) return
  history.splice(0, history.length - maxMessages)
}

function buildPrompt(
  history: Array<{ role: "user" | "assistant"; text: string }>,
  settings: SessionSettings
): string {
  const system =
    (settings.systemPrompt || "").trim() ||
    "You are Copilot, a helpful assistant for general users across platforms. Be correct, practical, and concise. Do not assume a specific OS unless the user specifies one. Ask one clarifying question only when necessary."

  const style = (settings.style || "balanced") as NonNullable<SessionSettings["style"]>
  const styleLine = styleInstruction(style)

  const lines = history
    .filter((m) => m.text && m.text.trim())
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text.trim()}`)

  return [
    system,
    styleLine ? `\n${styleLine}` : "",
    "\nConversation:",
    ...lines,
    "\nAssistant:"
  ].join("\n")
}

function styleInstruction(style: NonNullable<SessionSettings["style"]>): string {
  switch (style) {
    case "precise":
      return "Style: direct and precise. Prefer short answers, commands, and step-by-step instructions when needed."
    case "creative":
      return "Style: exploratory and helpful. Offer 2-3 options when appropriate, but still stay practical."
    case "balanced":
    default:
      return "Style: clear and helpful. Keep it concise, but include key details and examples."
  }
}
