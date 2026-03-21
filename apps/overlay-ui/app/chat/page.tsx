"use client";

import CopilotPanel from "@/components/CopilotPanel";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Header from "@/components/Header";

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <Header />
      <main className="min-h-[calc(100vh-73px)]">
        <CopilotPanel />
      </main>
    </ProtectedRoute>
  );
}
