export type ToolCall =
  | { tool: "open_app"; app: string }
  | { tool: "type_text"; text: string }
  | { tool: "paste_text"; text: string }
  | { tool: "press_keys"; keys: string }
  | { tool: "click"; x?: number; y?: number; button?: "left" | "right" }
  | { tool: "move_mouse"; x: number; y: number }
  | { tool: "wait_ms"; ms: number };

export type Plan = {
  id: string;
  ts: number;
  input: string;
  steps: ToolCall[];
};

// Minimal Windows-only planner. We can replace this with an LLM router later.
export function planFromTranscript(transcript: string): Plan | null {
  const input = transcript.trim();
  if (!input) return null;

  const lower = input.toLowerCase();
  const steps: ToolCall[] = [];

  // Open app: "open notepad", "open calculator", "open chrome"
  const openMatch = lower.match(/\bopen\s+([a-z0-9 ._-]+)\b/);
  if (openMatch?.[1]) {
    steps.push({ tool: "open_app", app: openMatch[1].trim() });
  }

  // Write/type/paste: 'type hello', 'write "hello"', 'paste "hello"'
  const writeMatch = input.match(/\b(type|write|paste)\s+(?:"([^"]+)"|'([^']+)'|(.+))$/i);
  const writeVerb = (writeMatch?.[1] || "").toLowerCase();
  const writeText = (writeMatch?.[2] || writeMatch?.[3] || writeMatch?.[4] || "").trim();
  if (writeText) {
    // If we open an app, give it a moment to take focus before writing.
    if (openMatch?.[1]) steps.push({ tool: "wait_ms", ms: 800 });

    const needsPaste =
      writeVerb === "paste" ||
      /[+^%~(){}[\]]/.test(writeText) || // SendKeys special chars
      writeText.length > 20;

    steps.push(needsPaste ? { tool: "paste_text", text: writeText } : { tool: "type_text", text: writeText });
  }

  // Press: 'press enter' or 'press ctrl+s'
  const pressMatch = lower.match(/\bpress\s+([a-z0-9+ -]+)\b/);
  if (pressMatch?.[1]) {
    steps.push({ tool: "press_keys", keys: pressMatch[1].trim() });
  }

  // Click: 'click' or 'click 100 200'
  const clickMatch = lower.match(/\bclick(?:\s+(\d+)\s+(\d+))?\b/);
  if (clickMatch) {
    const x = clickMatch[1] ? Number(clickMatch[1]) : null;
    const y = clickMatch[2] ? Number(clickMatch[2]) : null;
    const step: ToolCall = {
      tool: "click",
      button: "left",
      ...(x != null ? { x } : {}),
      ...(y != null ? { y } : {})
    };
    steps.push(step);
  }

  if (steps.length === 0) return null;

  return {
    id: `plan_${Date.now().toString(36)}`,
    ts: Date.now(),
    input,
    steps
  };
}
