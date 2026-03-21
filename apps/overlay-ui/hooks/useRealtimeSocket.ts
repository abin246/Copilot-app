"use client";

import { useEffect, useRef, useState } from "react";

export type ToolCall =
  | { tool: "open_app"; app: string }
  | { tool: "type_text"; text: string }
  | { tool: "paste_text"; text: string }
  | { tool: "press_keys"; keys: string }
  | { tool: "wait_ms"; ms: number }
  | { tool: "click"; x?: number; y?: number; button?: "left" | "right" }
  | { tool: "move_mouse"; x: number; y: number };

export type Plan = { id: string; ts: number; input: string; steps: ToolCall[] };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
  plan?: Plan;
  streaming?: boolean;
  error?: boolean;
};

export type ResponseStyle = "balanced" | "precise" | "creative";

export type ChatSettings = {
  model?: string;
  temperature?: number;
  style?: ResponseStyle;
  systemPrompt?: string;
};

export function useRealtimeSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const pendingUserEchoRef = useRef<{ id: string; text: string } | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "session") {
        setSessionId(message.data);
      }

      if (message.type === "transcript") {
        const text = String(message.data || "").trim();
        if (!text) return;

        const pending = pendingUserEchoRef.current;
        if (pending && pending.text === text) {
          // This transcript is the echo of a text message we already rendered optimistically.
          pendingUserEchoRef.current = null;
          lastUserIdRef.current = pending.id;
          return;
        }

        const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        lastUserIdRef.current = id;
        setMessages((prev) => [...prev, { id, role: "user", text, ts: Date.now() }]);
      }

      if (message.type === "ai_begin") {
        const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        activeAssistantIdRef.current = id;
        setMessages((prev) => [...prev, { id, role: "assistant", text: "", ts: Date.now(), streaming: true }]);
      }

      if (message.type === "ai") {
        const chunk = String(message.data || "");
        if (!chunk) return;
        const activeId = activeAssistantIdRef.current;

        setMessages((prev) => {
          if (activeId) {
            return prev.map((m) => (m.id === activeId ? { ...m, text: m.text + chunk } : m));
          }

          // Fallback for older servers that don't emit `ai_begin`.
          const id = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
          activeAssistantIdRef.current = id;
          return [...prev, { id, role: "assistant", text: chunk, ts: Date.now(), streaming: true }];
        });
      }

      if (message.type === "ai_end") {
        const activeId = activeAssistantIdRef.current;
        if (!activeId) return;
        activeAssistantIdRef.current = null;
        setMessages((prev) => prev.map((m) => (m.id === activeId ? { ...m, streaming: false } : m)));
      }

      if (message.type === "error") {
        const id = `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        activeAssistantIdRef.current = null;
        setMessages((prev) => [
          ...prev,
          { id, role: "assistant", text: `Error: ${String(message.data || "")}`, ts: Date.now(), error: true }
        ]);
      }

      if (message.type === "plan") {
        try {
          const parsed =
            typeof message.data === "string"
              ? JSON.parse(message.data)
              : message.data;
          const plan = parsed as Plan;
          const lastUserId = lastUserIdRef.current;
          if (!lastUserId) return;
          setMessages((prev) => prev.map((m) => (m.id === lastUserId ? { ...m, plan } : m)));
        } catch {
          // ignore invalid plan payloads
        }
      }
    };

    return () => ws.close();
  }, [url]);

  function sendAudioChunk(blob: Blob) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    blob.arrayBuffer().then((buffer) => {
      wsRef.current?.send(buffer);
    });
  }

  function sendText(text: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const t = String(text || "").trim();
    if (!t) return;

    // Optimistic render, then let the server echo confirm (deduped above).
    const id = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    pendingUserEchoRef.current = { id, text: t };
    lastUserIdRef.current = id;
    setMessages((prev) => [...prev, { id, role: "user", text: t, ts: Date.now() }]);

    const payload = { type: "text", data: t };
    ws.send(JSON.stringify(payload));
  }

  function sendSettings(settings: ChatSettings) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "settings", data: settings || {} }));
  }

  function reset() {
    try {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "reset", data: null }));
    } catch {
      // ignore
    }
    lastUserIdRef.current = null;
    activeAssistantIdRef.current = null;
    pendingUserEchoRef.current = null;
    setMessages([]);
  }

  return { status, sessionId, messages, sendAudioChunk, sendText, sendSettings, reset };
}
