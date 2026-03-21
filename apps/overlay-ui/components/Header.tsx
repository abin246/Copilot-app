"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="bg-[#0d1117] border-b border-[#30363d]">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold text-[#58a6ff]">
          CoPilot
        </Link>

        {user && (
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-[#e6edf3] hover:text-[#58a6ff] transition"
            >
              Home
            </Link>
            <Link
              href="/chat"
              className="text-[#e6edf3] hover:text-[#58a6ff] transition"
            >
              Chat
            </Link>
            <Link
              href="/meeting-auto"
              className="text-[#e6edf3] hover:text-[#58a6ff] transition"
            >
              Auto Meeting
            </Link>
            <Link
              href="/meetings"
              className="text-[#e6edf3] hover:text-[#58a6ff] transition"
            >
              Meetings
            </Link>
            <Link
              href="/settings"
              className="text-[#e6edf3] hover:text-[#58a6ff] transition"
            >
              Settings
            </Link>

            <div className="flex items-center gap-3 pl-6 border-l border-[#30363d]">
              <span className="text-[#8b949e] text-sm">{user.email}</span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-[#da3633] hover:bg-[#f85149] text-white rounded text-sm transition"
              >
                Logout
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
