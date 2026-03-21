"use client";

import Header from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MeetingEvent =
  | { ts: number; type: "session"; sessionId: string }
  | { ts: number; type: "transcript"; text: string }
  | { ts: number; type: "ai"; text: string }
  | { ts: number; type: "error"; message: string };

type MeetingApiResponse = {
  sessionId?: string;
  events?: MeetingEvent[];
  error?: string;
};

export default function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const sessionId = params.id;

  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch(`${backendUrl}/api/meetings/${sessionId}`);
        const data = (await res.json()) as MeetingApiResponse;
        if (!res.ok) {
          throw new Error(data.error || "Failed to load meeting");
        }
        if (!active) return;
        setEvents(Array.isArray(data.events) ? data.events : []);
        setError(null);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || "Failed to load meeting");
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [backendUrl, sessionId]);

  const transcript = useMemo(
    () =>
      events
        .filter((e) => e.type === "transcript")
        .map((e) => e.text)
        .join(" "),
    [events]
  );

  const ai = useMemo(
    () =>
      events
        .filter((e) => e.type === "ai")
        .map((e) => e.text)
        .join(""),
    [events]
  );

  return (
    <ProtectedRoute>
      <Header />
      <main className="min-h-[calc(100vh-73px)] px-4 py-8">
        <div className="mx-auto w-full max-w-5xl space-y-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold">Meeting</h1>
              <div className="mt-1 font-mono text-sm text-white/55">{sessionId}</div>
            </div>
            <div className="flex gap-4 text-sm">
              <Link className="text-white/70 hover:text-white underline decoration-white/20" href="/meetings">
                All meetings
              </Link>
              <Link className="text-white/70 hover:text-white underline decoration-white/20" href="/chat">
                Back to chat
              </Link>
            </div>
          </div>

          {loading ? <div className="text-sm text-[#8b949e]">Loading meeting details...</div> : null}
          {error ? <div className="text-sm text-red-200">Error: {error}</div> : null}

          {!loading && !error ? (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                  <h2 className="font-semibold">Transcript</h2>
                  <p className="text-sm whitespace-pre-wrap text-white/80">{transcript || "No transcript captured yet."}</p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-2">
                  <h2 className="font-semibold">AI Output</h2>
                  <p className="text-sm whitespace-pre-wrap text-white/80">{ai || "No AI output yet."}</p>
                </section>
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                <h2 className="font-semibold">Raw Events</h2>
                <div className="space-y-2">
                  {events.length === 0 ? (
                    <div className="text-white/55 text-sm">No events yet.</div>
                  ) : (
                    events.map((e, idx) => (
                      <div key={idx} className="text-xs text-white/80">
                        <span className="font-mono text-white/45">{new Date(e.ts).toLocaleTimeString()} </span>
                        <span className="font-mono">{e.type}</span>{" "}
                        {e.type === "transcript" ? e.text : null}
                        {e.type === "ai" ? e.text : null}
                        {e.type === "error" ? e.message : null}
                        {e.type === "session" ? e.sessionId : null}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </ProtectedRoute>
  );
}
