"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <ProtectedRoute>
      <main className="min-h-screen flex items-center justify-center bg-[#0b0f14]">
        <p className="text-[#8b949e]">Redirecting to home...</p>
      </main>
    </ProtectedRoute>
  );
}
