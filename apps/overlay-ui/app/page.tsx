"use client";

import Header from "@/components/Header";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Meeting = {
  id?: number;
  session_id?: string;
  sessionId?: string;
  created_at?: string;
  createdAt?: string;
  duration_seconds?: number;
  durationSeconds?: number;
  participant_count?: number;
  participantCount?: number;
};

type MeetingsResponse = {
  meetings?: Meeting[];
};

export default function HomePage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadMeetings() {
      try {
        const res = await fetch(`${backendUrl}/api/meetings`);
        const data = (await res.json()) as Meeting[] | MeetingsResponse;
        const payload = Array.isArray(data) ? data : data?.meetings;
        if (!active) return;
        setMeetings(Array.isArray(payload) ? payload : []);
      } catch {
        if (!active) return;
        setMeetings([]);
      } finally {
        if (!active) return;
        setLoading(false);
      }
    }

    void loadMeetings();
    return () => {
      active = false;
    };
  }, [backendUrl]);

  const recentMeetings = useMemo(() => meetings.slice(0, 6), [meetings]);

  return (
    <ProtectedRoute>
      <Header />
      <main className="bg-[#0b0f14] min-h-[calc(100vh-73px)]">
        <div className="max-w-7xl mx-auto px-4 py-10 md:py-14 space-y-10">
          <section className="rounded-2xl border border-[#30363d] bg-gradient-to-br from-[#0d1117] to-[#161b22] p-6 md:p-8">
            <p className="text-sm uppercase tracking-[0.2em] text-[#8b949e]">Copilot Workspace</p>
            <h1 className="mt-3 text-3xl md:text-5xl font-bold leading-tight">
              Run focused chat sessions and keep every meeting traceable.
            </h1>
            <p className="mt-4 text-[#8b949e] max-w-3xl">
              Start a new session for live chat and voice input, then review transcripts and AI outputs from your recent sessions.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="px-5 py-2.5 rounded-lg bg-[#238636] hover:bg-[#2ea043] text-white font-medium transition"
              >
                Start Chat Session
              </Link>
              <Link
                href="/meetings"
                className="px-5 py-2.5 rounded-lg border border-[#30363d] hover:bg-[#161b22] transition"
              >
                View All Meetings
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Total Sessions" value={String(meetings.length)} helper="Saved meeting sessions" />
            <StatCard label="Recent Sessions" value={String(recentMeetings.length)} helper="Shown on this landing page" />
            <StatCard label="Chat Entry" value="Live" helper="Open /chat for active assistant" />
          </section>

          <section className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold">Recent Sessions</h2>
              <Link href="/meetings" className="text-sm text-[#58a6ff] hover:underline">
                See all
              </Link>
            </div>

            {loading ? (
              <p className="text-[#8b949e]">Loading sessions...</p>
            ) : recentMeetings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#30363d] px-5 py-8 text-center">
                <p className="text-[#8b949e]">No sessions yet. Start a chat session to create your first meeting record.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentMeetings.map((meeting, idx) => {
                  const sessionId = meeting.session_id || meeting.sessionId || "unknown-session";
                  const createdAt = meeting.created_at || meeting.createdAt;
                  const duration = meeting.duration_seconds || meeting.durationSeconds || 0;
                  const participants = meeting.participant_count || meeting.participantCount || 0;

                  return (
                    <div
                      key={`${sessionId}-${idx}`}
                      className="rounded-xl border border-[#30363d] bg-[#0b0f14] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <p className="font-mono text-sm text-[#c9d1d9]">{sessionId}</p>
                        <p className="text-xs text-[#8b949e] mt-1">
                          {createdAt ? new Date(createdAt).toLocaleString() : "Unknown time"} - {Math.floor(duration / 60)} min - {participants} participants
                        </p>
                      </div>
                      <Link
                        href={`/meetings/${sessionId}`}
                        className="self-start sm:self-auto px-4 py-2 rounded-lg border border-[#30363d] hover:bg-[#161b22] text-sm transition"
                      >
                        Open Details
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-[#30363d] bg-[#0d1117] p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Auto Meeting Assistant</h2>
              <p className="text-[#8b949e] text-sm mt-1">
                Monitor Zoom/Teams/Meet sessions and generate replies for active meetings.
              </p>
            </div>
            <Link
              href="/meeting-auto"
              className="px-5 py-2.5 rounded-lg border border-[#30363d] hover:bg-[#161b22] transition"
            >
              Open Auto Meeting
            </Link>
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5">
      <p className="text-sm text-[#8b949e]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-xs text-[#6e7681]">{helper}</p>
    </div>
  );
}
