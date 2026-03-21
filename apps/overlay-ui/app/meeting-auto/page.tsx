"use client";

import Header from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAudioStream } from "@/hooks/useAudioStream";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type MeetingAppId = "zoom" | "teams" | "google_meet";
type ResponseMode = "auto" | "concise" | "detailed" | "action_items" | "rewrite";

type AutoMeetingSession = {
  appId: MeetingAppId;
  sessionId: string;
  startedAt: number;
  lastSeenAt: number;
  title: string;
  processName: string;
};

type AutoMeetingStatus = {
  enabled: boolean;
  running: boolean;
  pollMs: number;
  endGraceMs: number;
  platform: string;
  detectionMode?: "local-windows" | "endpoint";
  detectionEndpoint?: string | null;
  lastPollAt?: number | null;
  lastSuccessAt?: number | null;
  lastError?: string | null;
  lastDetectedWindows?: number;
  lastMatchedApps?: number;
  sessions: AutoMeetingSession[];
};

type InputSuccess = {
  ok: true;
  sessionId: string;
  appId: MeetingAppId;
  reply: string;
  automation: { ok: boolean; resultsCount: number } | null;
  transcript?: string;
};

type InputError = {
  ok: false;
  error: string;
  message: string;
};

export default function AutoMeetingPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const [status, setStatus] = useState<AutoMeetingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedApp, setSelectedApp] = useState<MeetingAppId | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<InputSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<ResponseMode>("auto");
  const [customInstruction, setCustomInstruction] = useState("");
  const [autoListen, setAutoListen] = useState(false);
  const [listening, setListening] = useState(false);
  const sendingAudioRef = useRef(false);

  const onAudioChunk = useCallback(
    async (blob: Blob) => {
      if (!autoListen) return;
      if (sendingAudioRef.current) return;
      sendingAudioRef.current = true;

      try {
        const params = new URLSearchParams();
        if (selectedApp) params.set("appId", selectedApp);
        if (responseMode) params.set("responseMode", responseMode);
        if (customInstruction.trim()) params.set("customInstruction", customInstruction.trim());
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`${backendUrl}/api/meeting-auto/audio${query}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob
        });

        // 202 = no speech in this chunk; not an error.
        if (res.status === 202) return;

        const rawText = await res.text();
        let payload: any = null;
        try {
          payload = rawText ? JSON.parse(rawText) : null;
        } catch {
          payload = null;
        }

        if (!res.ok) {
          const msg =
            payload?.message ||
            payload?.error ||
            rawText ||
            `Audio processing failed (HTTP ${res.status})`;
          throw new Error(msg);
        }

        const data = payload as InputSuccess | null;
        if (!data || data.ok !== true) {
          throw new Error("Audio processing failed: invalid response payload");
        }

        setResponse(data);
        setError(null);
      } catch (err: any) {
        setError(err?.message || "Auto audio processing failed");
      } finally {
        sendingAudioRef.current = false;
      }
    },
    [autoListen, backendUrl, selectedApp, responseMode, customInstruction]
  );

  const { start, stop, volume } = useAudioStream(onAudioChunk);
  const activeSessions = status?.sessions || [];
  const monitorBadge = useMemo(() => {
    if (!status) return "Unknown";
    if (!status.enabled) return "Disabled";
    if (status.running) return "Running";
    return "Stopped";
  }, [status]);

  async function fetchStatus(showRefresh = false) {
    try {
      if (showRefresh) setRefreshing(true);
      const res = await fetch(`${backendUrl}/api/meeting-auto/status`);
      const data = (await res.json()) as AutoMeetingStatus;
      setStatus(data);
      setError(null);
    } catch {
      setError("Failed to load auto meeting status");
    } finally {
      setLoading(false);
      if (showRefresh) setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchStatus();
    const id = window.setInterval(() => {
      void fetchStatus();
    }, 5000);
    return () => window.clearInterval(id);
  }, [backendUrl]);

  useEffect(() => {
    let cancelled = false;

    async function syncMic() {
      const shouldListen = autoListen && activeSessions.length > 0;

      if (shouldListen && !listening) {
        try {
          await start();
          if (!cancelled) setListening(true);
        } catch (err: any) {
          if (!cancelled) {
            setAutoListen(false);
            setListening(false);
            setError(err?.message || "Microphone permission denied or unavailable");
          }
        }
        return;
      }

      if (!shouldListen && listening) {
        stop();
        if (!cancelled) setListening(false);
      }
    }

    void syncMic();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoListen, activeSessions.length, listening, selectedApp]);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setSubmitting(true);
    setResponse(null);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/api/meeting-auto/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          ...(selectedApp ? { appId: selectedApp } : {}),
          responseMode,
          ...(customInstruction.trim() ? { customInstruction: customInstruction.trim() } : {})
        })
      });

      const data = (await res.json()) as InputSuccess | InputError;
      if (!res.ok || !("ok" in data) || !data.ok) {
        const msg = "message" in data ? data.message : "Request failed";
        throw new Error(msg);
      }

      setResponse(data);
      setDraft("");
      void fetchStatus();
    } catch (err: any) {
      setError(err?.message || "Failed to send input");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProtectedRoute>
      <Header />
      <main className="bg-[#0b0f14] min-h-[calc(100vh-73px)]">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
          <section className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">Auto Meeting Assistant</h1>
                <p className="text-[#8b949e] mt-2">
                  Detect Zoom/Teams/Meet sessions automatically and send AI responses to active meetings.
                </p>
              </div>
              <button
                onClick={() => void fetchStatus(true)}
                disabled={refreshing}
                className="px-4 py-2 rounded-lg border border-[#30363d] hover:bg-[#161b22] text-sm disabled:opacity-50"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Monitor" value={monitorBadge} />
            <StatCard label="Platform" value={status?.platform || "Unknown"} />
            <StatCard label="Active Sessions" value={String(activeSessions.length)} />
            <StatCard label="Poll Interval" value={status ? `${status.pollMs}ms` : "..."} />
          </section>

          <section className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
            <p className="text-xs text-[#8b949e]">
              Detection mode: <span className="font-mono">{status?.detectionMode || "unknown"}</span>
              {status?.detectionEndpoint ? (
                <>
                  {" "}
                  | endpoint: <span className="font-mono">{status.detectionEndpoint}</span>
                </>
              ) : null}
            </p>
            <p className="text-xs text-[#8b949e] mt-2">
              Last poll: {status?.lastPollAt ? new Date(status.lastPollAt).toLocaleTimeString() : "never"} | Last success:{" "}
              {status?.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleTimeString() : "never"} | Windows:{" "}
              {status?.lastDetectedWindows ?? 0} | Matches: {status?.lastMatchedApps ?? 0}
            </p>
            {status?.lastError ? (
              <p className="text-xs text-red-300 mt-2">Detection error: {status.lastError}</p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-6 space-y-4">
            <h2 className="text-xl font-bold">Detected Meeting Sessions</h2>

            {loading ? (
              <p className="text-[#8b949e]">Loading monitor status...</p>
            ) : activeSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#30363d] p-5 text-[#8b949e]">
                No active meeting apps detected right now.
              </div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <div
                    key={`${session.appId}-${session.sessionId}`}
                    className="rounded-xl border border-[#30363d] bg-[#0b0f14] p-4"
                  >
                    <div className="flex flex-wrap gap-2 justify-between">
                      <div>
                        <p className="font-semibold">{labelForApp(session.appId)}</p>
                        <p className="text-sm text-[#8b949e]">{session.title}</p>
                      </div>
                      <p className="font-mono text-xs text-[#8b949e]">{session.sessionId}</p>
                    </div>
                    <p className="text-xs text-[#6e7681] mt-2">
                      Process: {session.processName} | Last Seen: {new Date(session.lastSeenAt).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-6">
            <h2 className="text-xl font-bold mb-4">Send Input To Active Meeting Session</h2>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#30363d] bg-[#0b0f14] p-3">
              <div className="text-sm text-[#8b949e]">
                Auto mic capture:{" "}
                <span className={listening ? "text-green-300" : "text-[#8b949e]"}>
                  {listening ? "Listening" : "Stopped"}
                </span>{" "}
                {listening ? <span className="font-mono">({Math.round(volume)})</span> : null}
              </div>
              <button
                onClick={() => setAutoListen((v) => !v)}
                disabled={activeSessions.length === 0}
                className={[
                  "px-4 py-2 rounded-lg text-sm border",
                  autoListen
                    ? "bg-green-500/10 border-green-400/30 text-green-200"
                    : "border-[#30363d] hover:bg-[#161b22]",
                  activeSessions.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                ].join(" ")}
              >
                {autoListen ? "Stop Auto Capture" : "Start Auto Capture"}
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-2 text-[#8b949e]">Target App (optional)</label>
                <select
                  value={selectedApp}
                  onChange={(e) => setSelectedApp(e.target.value as MeetingAppId | "")}
                  className="w-full rounded-lg border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-sm"
                >
                  <option value="">Most recent active session</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="google_meet">Google Meet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2 text-[#8b949e]">Response Type</label>
                <select
                  value={responseMode}
                  onChange={(e) => setResponseMode(e.target.value as ResponseMode)}
                  className="w-full rounded-lg border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-sm"
                >
                  <option value="auto">Auto</option>
                  <option value="concise">Concise</option>
                  <option value="detailed">Detailed</option>
                  <option value="action_items">Action Items</option>
                  <option value="rewrite">Rewrite Professional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2 text-[#8b949e]">Custom Instruction (optional)</label>
                <input
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="Example: Reply in polite Hindi-English mix."
                  className="w-full rounded-lg border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm mb-2 text-[#8b949e]">What should Copilot answer?</label>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  placeholder="Example: Draft a concise response for this discussion point..."
                  className="w-full rounded-lg border border-[#30363d] bg-[#0b0f14] px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !draft.trim()}
                className="px-5 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white font-medium disabled:opacity-50"
              >
                {submitting ? "Generating..." : "Generate Meeting Reply"}
              </button>
            </form>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-900/20 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {response ? (
              <div className="mt-4 rounded-lg border border-[#30363d] bg-[#0b0f14] p-4 space-y-2">
                <p className="text-xs text-[#8b949e]">
                  Session: <span className="font-mono">{response.sessionId}</span> ({labelForApp(response.appId)})
                </p>
                {response.transcript ? (
                  <p className="text-xs text-[#8b949e]">
                    Heard: <span className="text-[#c9d1d9]">{response.transcript}</span>
                  </p>
                ) : null}
                <p className="text-sm whitespace-pre-wrap">{response.reply || "(empty response)"}</p>
                {response.automation ? (
                  <p className="text-xs text-[#8b949e]">
                    Cross-app output: {response.automation.ok ? "sent" : "failed"}
                  </p>
                ) : (
                  <p className="text-xs text-[#8b949e]">
                    Cross-app output not attempted. Enable `AUTO_MEETING_REPLY_TO_APP=true`.
                  </p>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

function labelForApp(appId: MeetingAppId): string {
  if (appId === "zoom") return "Zoom";
  if (appId === "teams") return "Microsoft Teams";
  return "Google Meet";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
      <p className="text-xs text-[#8b949e]">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
