"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b0f14] to-[#161b22] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2">CoPilot</h1>
          <p className="text-center text-[#8b949e] mb-8">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#238636] hover:bg-[#2ea043] text-white font-medium rounded transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[#8b949e] text-sm">
              Don't have an account?{" "}
              <Link href="/register" className="text-[#58a6ff] hover:underline">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
