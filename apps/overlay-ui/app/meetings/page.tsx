"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import Link from "next/link";
import { useState, useEffect } from "react";

interface Meeting {
  id: number;
  session_id: string;
  created_at: string;
  duration_seconds: number;
  participant_count: number;
}

type MeetingsResponse = {
  meetings?: Meeting[];
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  useEffect(() => {
    fetchMeetings();
  }, [backendUrl]);

  const fetchMeetings = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/meetings`);
      const data = (await res.json()) as Meeting[] | MeetingsResponse;
      if (!res.ok) throw new Error("Failed to load meetings");
      const payload = Array.isArray(data) ? data : data?.meetings;
      setMeetings(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Header />
      <main className="bg-[#0b0f14] min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Your Meetings</h1>

          {loading ? (
            <div className="text-[#8b949e]">Loading meetings...</div>
          ) : meetings.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-8 text-center">
              <p className="text-[#8b949e]">No meetings yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {meetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold mb-2">
                        Session: {meeting.session_id.slice(0, 8)}...
                      </h3>
                      <p className="text-[#8b949e] text-sm">
                        Duration: {Math.floor(meeting.duration_seconds / 60)} minutes
                      </p>
                      <p className="text-[#8b949e] text-sm">
                        Participants: {meeting.participant_count}
                      </p>
                      <p className="text-[#6e7681] text-xs mt-2">
                        {new Date(meeting.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Link
                      href={`/meetings/${meeting.session_id}`}
                      className="px-4 py-2 bg-[#0969da] hover:bg-[#0860ca] text-white rounded text-sm"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ProtectedRoute>
  );
}
