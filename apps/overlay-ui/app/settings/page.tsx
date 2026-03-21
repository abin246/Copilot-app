"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <ProtectedRoute>
      <Header />
      <main className="bg-[#0b0f14] min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          {saved && (
            <div className="mb-6 p-4 bg-green-900/20 border border-green-500/50 rounded text-green-200">
              Settings saved successfully
            </div>
          )}

          {/* Profile Settings */}
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-6">Profile Information</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  defaultValue={user?.name}
                  className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email}
                  className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">User ID</label>
                <input
                  type="text"
                  defaultValue={user?.id}
                  className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-6">Preferences</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Email Notifications</label>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Auto-transcribe Meetings</label>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Show Timestamps</label>
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[#238636] hover:bg-[#2ea043] text-white font-medium rounded transition"
          >
            Save Changes
          </button>
        </div>
      </main>
    </ProtectedRoute>
  );
}
