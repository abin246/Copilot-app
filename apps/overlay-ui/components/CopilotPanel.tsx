"use client";

import ActionSuggestions from "./ActionSuggestions";
import { useAudioStream } from "@/hooks/useAudioStream";
import { useRealtimeSocket } from "@/hooks/useRealtimeSocket";
import type { ChatSettings, ResponseStyle } from "@/hooks/useRealtimeSocket";
import { useEffect, useMemo, useRef, useState } from "react";

export default function CopilotPanel() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";

  const { status, sessionId, messages, sendAudioChunk, sendText, sendSettings, reset } =
    useRealtimeSocket(wsUrl);

  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [resolvedModel, setResolvedModel] = useState<string | null>(null);
  const { start, stop, volume } = useAudioStream(sendAudioChunk);

  const endRef = useRef<HTMLDivElement | null>(null);
  const settingsSendTimerRef = useRef<number | null>(null);
  const settingsSaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Auto-stick to bottom on new messages.
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    // Load persisted settings.
    try {
      const raw = window.localStorage.getItem("copilot_settings_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<LocalSettings>;
      setSettings((prev) => sanitizeLocalSettings({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Persist settings (debounced).
    if (settingsSaveTimerRef.current != null) window.clearTimeout(settingsSaveTimerRef.current);
    settingsSaveTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem("copilot_settings_v1", JSON.stringify(settings));
      } catch {
        // ignore
      }
    }, 250);

    return () => {
      if (settingsSaveTimerRef.current != null) window.clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    };
  }, [settings]);

  useEffect(() => {
    // Push settings to the server (debounced) once the socket is open.
    if (status !== "open") return;

    if (settingsSendTimerRef.current != null) window.clearTimeout(settingsSendTimerRef.current);
    const payload = toChatSettings(settings);

    settingsSendTimerRef.current = window.setTimeout(() => {
      sendSettings(payload);
    }, 150);

    return () => {
      if (settingsSendTimerRef.current != null) window.clearTimeout(settingsSendTimerRef.current);
      settingsSendTimerRef.current = null;
    };
  }, [settings, status, sendSettings]);

  async function refreshModels() {
    try {
      const res = await fetch(`${backendUrl}/api/models`);
      const json = await res.json();
      setAvailableModels(Array.isArray(json?.models) ? json.models.map(String) : []);
      setResolvedModel(typeof json?.resolved === "string" ? json.resolved : null);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (showSettings) void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSettings]);

  useEffect(() => {
    // Best-effort load so the header can show the resolved model name.
    void refreshModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "open") return "Connected";
    if (status === "closed") return "Disconnected";
    return "Connecting...";
  }, [status]);

  const modelLabel = useMemo(() => {
    if (settings.model) return settings.model;
    if (resolvedModel) return `Auto: ${resolvedModel}`;
    return "Auto";
  }, [resolvedModel, settings.model]);

  async function toggleMic() {
    if (listening) {
      stop();
      setListening(false);
      return;
    }
    await start();
    setListening(true);
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    sendText(text);
    setDraft("");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex md:w-72 flex-col border-r border-white/10 bg-white/[0.02]">
        <div className="p-4">
          <div className="text-sm font-semibold tracking-wide">Copilot</div>
          <div className="mt-1 text-xs text-white/55">Local voice, local actions</div>
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={() => reset()}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            New chat
          </button>
        </div>
        <div className="mt-auto px-4 py-4 text-xs text-white/45">
          {sessionId ? <div className="font-mono">session: {sessionId}</div> : <div>session: (pending)</div>}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-white/10 bg-black/20 backdrop-blur px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold">Chat</div>
            <div className="flex items-center gap-2 text-xs text-white/55">
              <span
                className={[
                  "inline-block h-2 w-2 rounded-full",
                  status === "open" ? "bg-green-400" : status === "closed" ? "bg-red-400" : "bg-yellow-400",
                ].join(" ")}
              />
              <span>{statusLabel}</span>
              <span className="hidden sm:inline text-white/35">|</span>
              <span className="hidden sm:inline text-white/55">{modelLabel}</span>
              {listening ? <span className="text-green-300">Listening</span> : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/meetings"
              className="hidden sm:inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              Meetings
            </a>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              aria-label="Open settings"
            >
              <GearIcon />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={() => reset()}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="text-lg font-semibold">Copilot Chat</div>
                <div className="mt-2 text-sm text-white/60">
                  Type a command or toggle the mic. Example: <span className="font-mono">open notepad and write "hello"</span>
                </div>
                <div className="mt-4 text-xs text-white/45">
                  Tip: Plans show up as "Suggested Actions" cards you can run.
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <MessageRow key={m.id} msg={m} backendUrl={backendUrl} />
            ))}

            <div ref={endRef} />
          </div>
        </div>

        <footer className="border-t border-white/10 bg-black/20 backdrop-blur px-4 py-4">
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-2xl border border-white/10 bg-black/30 shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
              <div className="p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Message..."
                  rows={1}
                  className="w-full resize-none bg-transparent outline-none text-sm leading-6 placeholder:text-white/35"
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void toggleMic()}
                    className={[
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm border",
                      listening ? "border-green-400/30 bg-green-500/10 text-green-200" : "border-white/10 bg-white/5 hover:bg-white/10",
                    ].join(" ")}
                    aria-pressed={listening}
                  >
                    <MicIcon active={listening} />
                    <span>{listening ? "Stop" : "Mic"}</span>
                    {listening ? (
                      <span className="ml-1 text-xs text-green-200/70 font-mono">
                        {Math.round(volume)}
                      </span>
                    ) : null}
                  </button>

                  <div className="text-xs text-white/45">
                    Enter to send, Shift+Enter for newline
                  </div>
                </div>

                <button
                  onClick={send}
                  disabled={!draft.trim() || status !== "open"}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                >
                  <span>Send</span>
                  <SendIcon />
                </button>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-white/35">
              Local STT (Whisper) + local LLM (Ollama). Automation defaults to dry-run in Docker.
            </div>
          </div>
        </footer>
      </div>

      {showSettings ? (
        <SettingsDrawer
          settings={settings}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
          onRefreshModels={() => void refreshModels()}
          availableModels={availableModels}
          resolvedModel={resolvedModel}
        />
      ) : null}
    </div>
  );
}

function MessageRow({
  msg,
  backendUrl,
}: {
  msg: { role: "user" | "assistant" | "system"; text: string; plan?: any; streaming?: boolean; error?: boolean };
  backendUrl: string;
}) {
  const isUser = msg.role === "user";
  const isAssistant = msg.role === "assistant";

  const wrap = isUser ? "justify-end" : "justify-start";
  const bubble = isUser
    ? "bg-green-500/10 border-green-400/20"
    : msg.error
      ? "bg-red-500/10 border-red-400/20"
      : "bg-white/[0.04] border-white/10";

  return (
    <div className={["flex", wrap].join(" ")}>
      <div className={["max-w-[92%] sm:max-w-[78%] rounded-2xl border px-4 py-3", bubble].join(" ")}>
        <div className="text-[11px] text-white/45">
          {isUser ? "You" : isAssistant ? "Copilot" : "System"}
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm leading-6">
          {msg.text || (msg.streaming ? "..." : "")}
          {msg.streaming ? <span className="inline-block w-2 animate-pulse">|</span> : null}
        </div>
        {msg.plan ? (
          <div className="mt-3">
            <ActionSuggestions dense plan={msg.plan} backendUrl={backendUrl} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={active ? "text-green-200" : "text-white/70"}
    >
      <path
        d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M12 18v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M8 21h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-white/70"
    >
      <path
        d="M2 21L23 12 2 3v7l15 2-15 2v7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-white/70"
    >
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.4 15a7.9 7.9 0 0 0 .1-1l1.7-1.3-1.7-3-2 .5a7.6 7.6 0 0 0-1.7-1L15.5 6h-3l-.3 2.2a7.6 7.6 0 0 0-1.7 1l-2-.5-1.7 3L8.5 14a7.9 7.9 0 0 0 .1 1l-1.7 1.3 1.7 3 2-.5c.5.4 1.1.7 1.7 1l.3 2.2h3l.3-2.2c.6-.3 1.2-.6 1.7-1l2 .5 1.7-3-1.7-1.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsDrawer({
  settings,
  onChange,
  onClose,
  onRefreshModels,
  availableModels,
  resolvedModel,
}: {
  settings: LocalSettings;
  onChange: (next: LocalSettings) => void;
  onClose: () => void;
  onRefreshModels: () => void;
  availableModels: string[];
  resolvedModel: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/60"
        aria-label="Close settings"
        onClick={onClose}
      />

      <div className="absolute right-0 top-0 h-full w-full sm:w-[440px] border-l border-white/10 bg-[#0b0f14] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <div className="h-14 px-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm font-semibold">Chat Settings</div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100%-56px)] space-y-5">
          <section className="space-y-2">
            <div className="text-sm font-semibold">Model</div>
            <div className="text-xs text-white/55">
              Auto uses the most stable local model (currently {resolvedModel || "unknown"}).
            </div>
            <div className="flex gap-2">
              <select
                value={settings.model}
                onChange={(e) => onChange(sanitizeLocalSettings({ ...settings, model: e.target.value }))}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              >
                <option value="">Auto (stable)</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                onClick={onRefreshModels}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Temperature</div>
              <div className="text-xs text-white/55 font-mono">{settings.temperature.toFixed(2)}</div>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={settings.temperature}
              onChange={(e) =>
                onChange(sanitizeLocalSettings({ ...settings, temperature: Number.parseFloat(e.target.value) }))
              }
              className="w-full accent-green-400"
            />
            <div className="text-xs text-white/55">Lower is more deterministic. Higher is more creative.</div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold">Response Style</div>
            <div className="grid grid-cols-3 gap-2">
              <StyleButton
                active={settings.style === "balanced"}
                label="Balanced"
                onClick={() => onChange(sanitizeLocalSettings({ ...settings, style: "balanced" }))}
              />
              <StyleButton
                active={settings.style === "precise"}
                label="Precise"
                onClick={() => onChange(sanitizeLocalSettings({ ...settings, style: "precise" }))}
              />
              <StyleButton
                active={settings.style === "creative"}
                label="Creative"
                onClick={() => onChange(sanitizeLocalSettings({ ...settings, style: "creative" }))}
              />
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-sm font-semibold">Custom Instructions</div>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => onChange(sanitizeLocalSettings({ ...settings, systemPrompt: e.target.value }))}
              placeholder="Optional. Example: Always answer with PowerShell commands."
              rows={6}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/35"
            />
            <div className="text-xs text-white/55">
              These instructions apply to this browser and are sent to the gateway via WebSocket.
            </div>
          </section>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => onChange(DEFAULT_SETTINGS)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              Reset Defaults
            </button>
            <div className="text-xs text-white/45">
              Automation: <span className="font-mono">/api/tools/execute</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StyleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-lg border px-3 py-2 text-sm",
        active ? "border-green-400/30 bg-green-500/10 text-green-200" : "border-white/10 bg-white/5 hover:bg-white/10",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

type LocalSettings = {
  model: string;
  temperature: number;
  style: ResponseStyle;
  systemPrompt: string;
};

const DEFAULT_SETTINGS: LocalSettings = {
  model: "",
  temperature: 0.2,
  style: "balanced",
  systemPrompt: "",
};

function sanitizeLocalSettings(incoming: Partial<LocalSettings>): LocalSettings {
  const out: LocalSettings = { ...DEFAULT_SETTINGS };

  if (typeof incoming.model === "string") out.model = incoming.model;
  if (typeof incoming.temperature === "number" && Number.isFinite(incoming.temperature)) out.temperature = incoming.temperature;
  if (incoming.style === "balanced" || incoming.style === "precise" || incoming.style === "creative") out.style = incoming.style;
  if (typeof incoming.systemPrompt === "string") out.systemPrompt = incoming.systemPrompt;

  out.model = out.model.trim();
  out.temperature = clamp(out.temperature, 0, 1.5);
  out.systemPrompt = out.systemPrompt.slice(0, 4000);

  return out;
}

function toChatSettings(s: LocalSettings): ChatSettings {
  return {
    model: s.model.trim() ? s.model.trim() : undefined,
    temperature: s.temperature,
    style: s.style,
    systemPrompt: s.systemPrompt.trim() ? s.systemPrompt : undefined,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// "use client";

// import AudioRecorder from "./AudioRecorder";
// import TranscriptView from "./TranscriptView";
// import StreamingResponse from "./StreamingResponse";
// import { useRealtimeSocket } from "@/hooks/useRealtimeSocket";

// export default function CopilotPanel() {
//   const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";
//   const { sessionId, transcript, aiResponse, sendAudioChunk } =
//     useRealtimeSocket(wsUrl);

//   return (
//     <div className="space-y-6">

//       <AudioRecorder onChunk={sendAudioChunk} />

//       {sessionId ? (
//         <div className="text-sm text-gray-300">
//           Meeting:{" "}
//           <a className="underline" href={`/meetings/${sessionId}`}>
//             {sessionId}
//           </a>
//         </div>
//       ) : null}

//       <TranscriptView transcript={transcript} />

//       <StreamingResponse text={aiResponse} />

//     </div>
//   );
// }
