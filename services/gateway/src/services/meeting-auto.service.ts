import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import axios from "axios";
import { meetingStore } from "./meeting-store.singleton.js";
import { streamLLMResponse } from "./llm.service.js";
import { transcribeAudio } from "./stt.service.js";
import { executeSteps } from "./windows-automation.service.js";

type MeetingAppId = "zoom" | "teams" | "google_meet";
export type ResponseMode = "auto" | "concise" | "detailed" | "action_items" | "rewrite";

type DetectedWindow = {
  processName: string;
  title: string;
  pid: number;
};

type AppMatch = {
  appId: MeetingAppId;
  processName: string;
  title: string;
  pid: number;
};

type SessionMessage = { role: "user" | "assistant"; text: string };
type ResponseOptions = {
  responseMode?: ResponseMode;
  customInstruction?: string;
};

type AutoSession = {
  appId: MeetingAppId;
  sessionId: string;
  startedAt: number;
  lastSeenAt: number;
  title: string;
  processName: string;
  history: SessionMessage[];
};

type AutoMeetingStatus = {
  enabled: boolean;
  running: boolean;
  pollMs: number;
  endGraceMs: number;
  platform: string;
  detectionMode: "local-windows" | "endpoint";
  detectionEndpoint: string | null;
  lastPollAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  lastDetectedWindows: number;
  lastMatchedApps: number;
  sessions: Array<{
    appId: MeetingAppId;
    sessionId: string;
    startedAt: number;
    lastSeenAt: number;
    title: string;
    processName: string;
  }>;
};

const SUPPORTED_APPS: Array<{ appId: MeetingAppId; label: string }> = [
  { appId: "zoom", label: "Zoom" },
  { appId: "teams", label: "Microsoft Teams" },
  { appId: "google_meet", label: "Google Meet" }
];

const POLL_MS = parseInt(process.env.AUTO_MEETING_POLL_MS || "4000", 10);
const END_GRACE_MS = parseInt(process.env.AUTO_MEETING_END_GRACE_MS || "30000", 10);
const ENABLED_BY_ENV = (process.env.AUTO_MEETING_MONITOR || "true").toLowerCase() === "true";
const REPLY_TO_APP = (process.env.AUTO_MEETING_REPLY_TO_APP || "false").toLowerCase() === "true";
const DETECT_ENDPOINT = (process.env.AUTO_MEETING_DETECT_ENDPOINT || process.env.AUTOMATION_ENDPOINT || "").trim();
const AUTOMATION_TOKEN = (process.env.AUTOMATION_TOKEN || "").trim();

let timer: NodeJS.Timeout | null = null;
let running = false;
let loopBusy = false;
let lastPollAt: number | null = null;
let lastSuccessAt: number | null = null;
let lastError: string | null = null;
let lastDetectedWindows = 0;
let lastMatchedApps = 0;

const sessionsByApp = new Map<MeetingAppId, AutoSession>();

function pwshExe(): string {
  return process.env.POWERSHELL_EXE || "powershell.exe";
}

function appLabel(appId: MeetingAppId): string {
  return SUPPORTED_APPS.find((a) => a.appId === appId)?.label || appId;
}

function classifyWindow(item: DetectedWindow): AppMatch | null {
  const process = item.processName.toLowerCase();
  const title = item.title.trim();
  const lowerTitle = title.toLowerCase();
  if (!title) return null;

  if (process.includes("zoom")) {
    if (/\b(meeting|webinar|zoom)\b/i.test(title)) {
      return { appId: "zoom", processName: item.processName, title, pid: item.pid };
    }
  }

  if (process.includes("teams") || process.includes("ms-teams")) {
    if (/\b(meeting|call|teams)\b/i.test(title)) {
      return { appId: "teams", processName: item.processName, title, pid: item.pid };
    }
  }

  if (process.includes("chrome") || process.includes("msedge")) {
    if (lowerTitle.includes("google meet") || /\bmeet\b/i.test(title)) {
      return { appId: "google_meet", processName: item.processName, title, pid: item.pid };
    }
  }

  return null;
}

async function detectMeetingWindows(): Promise<AppMatch[]> {
  if (process.platform !== "win32" && !DETECT_ENDPOINT) return [];

  let windows: DetectedWindow[] = [];
  if (DETECT_ENDPOINT) {
    windows = await detectViaEndpoint();
  } else {
    windows = await detectViaLocalPowershell();
  }

  const matches = new Map<MeetingAppId, AppMatch>();
  for (const window of windows) {
    const matched = classifyWindow(window);
    if (!matched) continue;
    if (!matches.has(matched.appId)) matches.set(matched.appId, matched);
  }

  lastDetectedWindows = windows.length;
  lastMatchedApps = matches.size;

  return [...matches.values()];
}

async function detectViaEndpoint(): Promise<DetectedWindow[]> {
  try {
    const base = DETECT_ENDPOINT.replace(/\/+$/, "");
    const res = await axios.get(`${base}/meeting-windows`, {
      timeout: 10_000,
      ...(AUTOMATION_TOKEN ? { headers: { "x-copilot-token": AUTOMATION_TOKEN } } : {})
    });

    const windowsRaw = Array.isArray(res.data?.windows) ? res.data.windows : [];
    return windowsRaw
      .map((row: any) => ({
        processName: String(row?.processName || ""),
        title: String(row?.title || "").trim(),
        pid: Number(row?.pid || 0)
      }))
      .filter((row: DetectedWindow) => row.processName && row.title);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastError = `endpoint detection failed: ${message}`;
    console.error("auto-meeting endpoint detection failed:", err);
    return [];
  }
}

async function detectViaLocalPowershell(): Promise<DetectedWindow[]> {
  const psScript = [
    "$items = Get-Process | Where-Object { $_.MainWindowTitle -and ($_.ProcessName -match 'zoom|teams|ms-teams|chrome|msedge') } | Select-Object ProcessName, MainWindowTitle, Id",
    "if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }"
  ].join("; ");

  const raw = await new Promise<string>((resolve) => {
    const child = spawn(pwshExe(), ["-NoProfile", "-NonInteractive", "-Command", psScript], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", () => resolve("[]"));
    child.on("exit", (code) => {
      if (code !== 0 && stderr) {
        console.error("auto-meeting powershell error:", stderr);
      }
      resolve(stdout.trim() || "[]");
    });
  });

  let parsed: any = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  const windows: DetectedWindow[] = list
    .map((row) => ({
      processName: String(row?.ProcessName || ""),
      title: String(row?.MainWindowTitle || "").trim(),
      pid: Number(row?.Id || 0)
    }))
    .filter((row) => row.processName && row.title);

  return windows;
}

function trimHistory(history: SessionMessage[], maxMessages: number) {
  if (history.length <= maxMessages) return;
  history.splice(0, history.length - maxMessages);
}

function modeInstruction(mode: ResponseMode): string {
  switch (mode) {
    case "concise":
      return "Response mode: concise. Keep responses short and direct.";
    case "detailed":
      return "Response mode: detailed. Explain clearly with structure and context.";
    case "action_items":
      return "Response mode: action items. Return clear bullet-like action points with owners when possible.";
    case "rewrite":
      return "Response mode: rewrite. Produce polished, professional ready-to-send wording.";
    case "auto":
    default:
      return "Response mode: auto. Pick the most useful response format for the user's request.";
  }
}

function modeMaxTokens(mode: ResponseMode): number {
  switch (mode) {
    case "concise":
      return 80;
    case "action_items":
      return 140;
    case "rewrite":
      return 180;
    case "detailed":
      return 260;
    case "auto":
    default:
      return 140;
  }
}

function buildPrompt(history: SessionMessage[], options: ResponseOptions = {}): string {
  const mode = options.responseMode || "auto";
  const custom = (options.customInstruction || "").trim();
  const lines = history
    .filter((m) => m.text.trim())
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text.trim()}`);

  return [
    "You are Copilot helping during a live meeting.",
    "Respond fast with clear, concise, professional wording (usually 1-3 short sentences).",
    "If asked for a draft response, provide ready-to-send text.",
    modeInstruction(mode),
    custom ? `Custom instruction: ${custom}` : "",
    "",
    "Conversation:",
    ...lines,
    "",
    "Assistant:"
  ].join("\n");
}

async function appendSystemTranscript(sessionId: string, text: string): Promise<void> {
  await meetingStore.appendMeetingEvent(sessionId, {
    ts: Date.now(),
    type: "transcript",
    text: `[system] ${text}`
  });
}

async function ensureSessionForMatch(match: AppMatch): Promise<AutoSession> {
  const existing = sessionsByApp.get(match.appId);
  if (existing) {
    existing.lastSeenAt = Date.now();
    existing.title = match.title;
    existing.processName = match.processName;
    return existing;
  }

  const sessionId = randomUUID();
  const now = Date.now();
  const created: AutoSession = {
    appId: match.appId,
    sessionId,
    startedAt: now,
    lastSeenAt: now,
    title: match.title,
    processName: match.processName,
    history: []
  };

  sessionsByApp.set(match.appId, created);

  await meetingStore.appendMeetingEvent(sessionId, { ts: now, type: "session", sessionId });
  await appendSystemTranscript(
    sessionId,
    `Auto-started meeting session for ${appLabel(match.appId)} (${match.title}).`
  );

  return created;
}

async function stopStaleSessions(activeAppIds: Set<MeetingAppId>): Promise<void> {
  const now = Date.now();
  const stale: MeetingAppId[] = [];

  for (const [appId, session] of sessionsByApp.entries()) {
    if (activeAppIds.has(appId)) continue;
    if (now - session.lastSeenAt < END_GRACE_MS) continue;
    stale.push(appId);
  }

  for (const appId of stale) {
    const session = sessionsByApp.get(appId);
    if (!session) continue;
    await appendSystemTranscript(session.sessionId, `Auto-ended session for ${appLabel(appId)}.`);
    sessionsByApp.delete(appId);
  }
}

async function monitorTick(): Promise<void> {
  lastPollAt = Date.now();
  const matches = await detectMeetingWindows();
  const activeAppIds = new Set<MeetingAppId>();

  for (const match of matches) {
    activeAppIds.add(match.appId);
    await ensureSessionForMatch(match);
  }

  await stopStaleSessions(activeAppIds);
  lastSuccessAt = Date.now();
  lastError = null;
}

export function startAutoMeetingMonitor() {
  if (running) return;
  if (!ENABLED_BY_ENV) {
    lastError = "monitor disabled by AUTO_MEETING_MONITOR=false";
    console.log("auto-meeting monitor disabled by env");
    return;
  }
  if (process.platform !== "win32" && !DETECT_ENDPOINT) {
    lastError = "no detection backend: set AUTO_MEETING_DETECT_ENDPOINT when running gateway off Windows";
    console.log("auto-meeting monitor requires Windows or AUTO_MEETING_DETECT_ENDPOINT; skipping startup");
    return;
  }

  running = true;
  timer = setInterval(async () => {
    if (loopBusy) return;
    loopBusy = true;
    try {
      await monitorTick();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = `monitor tick failed: ${message}`;
      console.error("auto-meeting monitor tick failed:", err);
    } finally {
      loopBusy = false;
    }
  }, Math.max(1500, POLL_MS));

  void monitorTick();
  const mode = DETECT_ENDPOINT ? `endpoint:${DETECT_ENDPOINT}` : "local-windows";
  console.log(`auto-meeting monitor started (mode=${mode}, poll=${POLL_MS}ms, endGrace=${END_GRACE_MS}ms)`);
}

export function stopAutoMeetingMonitor() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
}

export function getAutoMeetingStatus(): AutoMeetingStatus {
  return {
    enabled: ENABLED_BY_ENV,
    running,
    pollMs: Math.max(1500, POLL_MS),
    endGraceMs: Math.max(5_000, END_GRACE_MS),
    platform: process.platform,
    detectionMode: DETECT_ENDPOINT ? "endpoint" : "local-windows",
    detectionEndpoint: DETECT_ENDPOINT || null,
    lastPollAt,
    lastSuccessAt,
    lastError,
    lastDetectedWindows,
    lastMatchedApps,
    sessions: [...sessionsByApp.values()].map((s) => ({
      appId: s.appId,
      sessionId: s.sessionId,
      startedAt: s.startedAt,
      lastSeenAt: s.lastSeenAt,
      title: s.title,
      processName: s.processName
    }))
  };
}

function pickSession(appId?: MeetingAppId): AutoSession | null {
  if (appId) return sessionsByApp.get(appId) ?? null;

  const sessions = [...sessionsByApp.values()];
  if (sessions.length === 0) return null;
  sessions.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  return sessions[0] ?? null;
}

export async function submitAutoMeetingInput(input: {
  text: string;
  appId?: MeetingAppId;
  responseMode?: ResponseMode;
  customInstruction?: string;
}) {
  const session = pickSession(input.appId);
  if (!session) {
    return {
      ok: false as const,
      error: "no_active_meeting_session",
      message: "No active Zoom/Teams/Meet session is currently detected."
    };
  }

  const text = input.text.trim();
  if (!text) {
    return { ok: false as const, error: "invalid_text", message: "text is required" };
  }

  session.history.push({ role: "user", text });
  trimHistory(session.history, 8);

  await meetingStore.appendMeetingEvent(session.sessionId, {
    ts: Date.now(),
    type: "transcript",
    text
  });

  const mode = input.responseMode || "auto";
  const prompt = buildPrompt(session.history, {
    responseMode: mode,
    ...(input.customInstruction ? { customInstruction: input.customInstruction } : {})
  });
  let reply = "";

  await streamLLMResponse(
    prompt,
    (chunk) => {
      reply += chunk;
    },
    {
      temperature: 0.2,
      top_p: 0.9,
      num_ctx: 1024,
      num_predict: modeMaxTokens(mode)
    }
  );

  const finalReply = reply.trim();
  session.history.push({ role: "assistant", text: finalReply });
  trimHistory(session.history, 8);

  await meetingStore.appendMeetingEvent(session.sessionId, {
    ts: Date.now(),
    type: "ai",
    text: finalReply
  });

  let automation: { ok: boolean; resultsCount: number } | null = null;
  if (REPLY_TO_APP && finalReply) {
    const step =
      finalReply.length > 20 || /[+^%~(){}[\]]/.test(finalReply)
        ? { tool: "paste_text" as const, text: finalReply }
        : { tool: "type_text" as const, text: finalReply };

    const results = await executeSteps([step]);
    automation = { ok: results.every((r) => r.ok), resultsCount: results.length };
  }

  return {
    ok: true as const,
    sessionId: session.sessionId,
    appId: session.appId,
    reply: finalReply,
    automation
  };
}

export async function submitAutoMeetingAudio(input: {
  audio: Buffer;
  appId?: MeetingAppId;
  responseMode?: ResponseMode;
  customInstruction?: string;
}) {
  if (!input.audio || input.audio.length === 0) {
    return { ok: false as const, error: "invalid_audio", message: "audio is required" };
  }

  let transcript = "";
  try {
    transcript = (await transcribeAudio(input.audio)).trim();
  } catch (err: any) {
    const detail =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.message ||
      "STT request failed";
    return {
      ok: false as const,
      error: "stt_failed",
      message: `Speech-to-text failed: ${String(detail)}`
    };
  }
  if (!transcript) {
    return { ok: false as const, error: "empty_transcript", message: "No speech detected in this audio chunk." };
  }

  const result = await submitAutoMeetingInput({
    text: transcript,
    ...(input.appId ? { appId: input.appId } : {}),
    ...(input.responseMode ? { responseMode: input.responseMode } : {}),
    ...(input.customInstruction ? { customInstruction: input.customInstruction } : {})
  });

  if (!result.ok) return result;

  return {
    ...result,
    transcript
  };
}
