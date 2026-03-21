"use client";

import { useState } from "react";
import type { Plan, ToolCall } from "@/hooks/useRealtimeSocket";

export default function ActionSuggestions({
  plan,
  backendUrl,
  dense,
}: {
  plan: Plan | null;
  backendUrl: string;
  dense?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return null;
  const nonNullPlan = plan;

  async function run() {
    setRunning(true);
    setResults(null);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/tools/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: nonNullPlan.steps }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(`Failed: ${json?.error || res.status}`);
        return;
      }
      setResults(json?.results || []);
    } catch (e) {
      setError(`Failed: ${String(e)}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Suggested Actions</div>
          {dense ? null : <div className="text-xs text-white/55">{nonNullPlan.input}</div>}
        </div>
        <button
          disabled={running}
          onClick={run}
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-60 text-sm"
        >
          {running ? "Running..." : "Run"}
        </button>
      </div>

      <div className="text-xs text-white/75 whitespace-pre-wrap space-y-1">
        {nonNullPlan.steps.map((s, idx) => (
          <div key={idx} className="font-mono">
            {formatStep(s)}
          </div>
        ))}
      </div>

      {error ? <div className="text-xs text-red-200">{error}</div> : null}
      {results ? (
        <div className="text-xs font-mono text-white/70 whitespace-pre-wrap space-y-1">
          {results.map((r, idx) => (
            <div key={idx}>{formatResult(r)}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatStep(step: ToolCall): string {
  switch (step.tool) {
    case "open_app":
      return `open_app  ${step.app}`;
    case "type_text":
      return `type_text ${truncate(step.text)}`;
    case "paste_text":
      return `paste_text ${truncate(step.text)}`;
    case "wait_ms":
      return `wait_ms   ${Math.max(0, Math.trunc(step.ms))}ms`;
    case "press_keys":
      return `press_keys ${step.keys}`;
    case "move_mouse":
      return `move_mouse ${Math.trunc(step.x)},${Math.trunc(step.y)}`;
    case "click": {
      const pos = step.x != null && step.y != null ? ` ${Math.trunc(step.x)},${Math.trunc(step.y)}` : "";
      const btn = step.button || "left";
      return `click     ${btn}${pos}`;
    }
    default: {
      const exhaustive: never = step;
      return String(exhaustive);
    }
  }
}

function formatResult(r: any): string {
  const ok = r?.ok ? "ok" : "fail";
  const mode = r?.mode ? String(r.mode) : "unknown";
  const tool = r?.tool ? String(r.tool) : "unknown";
  const err = r?.error ? ` - ${String(r.error)}` : "";
  return `${ok} ${mode} ${tool}${err}`;
}

function truncate(s: string, max = 72): string {
  const t = String(s || "");
  if (t.length <= max) return JSON.stringify(t);
  return JSON.stringify(t.slice(0, max - 3) + "...");
}
