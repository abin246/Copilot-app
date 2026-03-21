import { spawn } from "node:child_process";
import type { ToolCall } from "../agents/planner.agent.js";
import axios from "axios";

export type AutomationResult = {
  ok: boolean;
  mode: "dry-run" | "live";
  tool: ToolCall["tool"];
  command: string;
  error?: string;
};

function pwshExe(): string {
  return process.env.POWERSHELL_EXE || "powershell.exe";
}

function escapePsSingleQuoted(s: string): string {
  return s.replace(/'/g, "''");
}

function buildCommand(step: ToolCall): string {
  switch (step.tool) {
    case "open_app":
      return `Start-Process '${escapePsSingleQuoted(step.app)}'`;
    case "type_text":
      return [
        `$ws = New-Object -ComObject WScript.Shell`,
        `$ws.SendKeys('${escapePsSingleQuoted(step.text)}')`
      ].join("; ");
    case "paste_text":
      return [
        // Uses clipboard paste for reliability with special characters.
        `Set-Clipboard -Value '${escapePsSingleQuoted(step.text)}'`,
        `$ws = New-Object -ComObject WScript.Shell`,
        `$ws.SendKeys('^v')`
      ].join("; ");
    case "press_keys":
      // Normalize "ctrl+s" -> ^s (SendKeys syntax), keep simple.
      return [
        `$ws = New-Object -ComObject WScript.Shell`,
        `$ws.SendKeys('${escapePsSingleQuoted(toSendKeys(step.keys))}')`
      ].join("; ");
    case "wait_ms":
      return `Start-Sleep -Milliseconds ${Math.max(0, Math.trunc(step.ms))}`;
    case "move_mouse":
      return [
        "Add-Type -AssemblyName System.Windows.Forms",
        `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.trunc(step.x)}, ${Math.trunc(step.y)})`
      ].join("; ");
    case "click": {
      const x = step.x != null ? Math.trunc(step.x) : null;
      const y = step.y != null ? Math.trunc(step.y) : null;
      const move = x != null && y != null
        ? [
            "Add-Type -AssemblyName System.Windows.Forms",
            `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})`
          ].join("; ") + "; "
        : "";

      // mouse_event via user32
      const mouse = [
        'Add-Type -Namespace Win32 -Name Mouse -MemberDefinition @\'',
        '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);',
        '@\'',
        "$down = 0x0002; $up = 0x0004",
        "[Win32.Mouse]::mouse_event($down,0,0,0,0); [Win32.Mouse]::mouse_event($up,0,0,0,0)"
      ].join("; ");

      return move + mouse;
    }
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

function toSendKeys(keys: string): string {
  const k = keys.trim().toLowerCase();
  if (k === "enter") return "{ENTER}";
  if (k === "tab") return "{TAB}";
  if (k === "escape" || k === "esc") return "{ESC}";

  // ctrl+something
  const ctrl = k.match(/^ctrl\s*\+\s*([a-z0-9])$/);
  if (ctrl?.[1]) return `^${ctrl[1]}`;

  return keys;
}

export async function executeTool(step: ToolCall): Promise<AutomationResult> {
  const mode = (process.env.AUTOMATION_MODE || "dry-run") as "dry-run" | "live";
  const command = buildCommand(step);

  if (mode !== "live") {
    return { ok: true, mode, tool: step.tool, command };
  }

  return await new Promise<AutomationResult>((resolve) => {
    const child = spawn(pwshExe(), ["-NoProfile", "-NonInteractive", "-Command", command], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      resolve({
        ok: false,
        mode,
        tool: step.tool,
        command,
        error: err instanceof Error ? err.message : String(err)
      });
    });

    child.on("exit", (code) => {
      const err = code === 0 ? null : stderr || `exit ${code}`;
      resolve({
        ok: code === 0,
        mode,
        tool: step.tool,
        command,
        ...(err ? { error: err } : {})
      });
    });
  });
}

export async function executeSteps(steps: ToolCall[]): Promise<AutomationResult[]> {
  const endpoint = process.env.AUTOMATION_ENDPOINT;
  if (endpoint) {
    try {
      const token = process.env.AUTOMATION_TOKEN;
      const res = await axios.post(
        `${endpoint.replace(/\/+$/, "")}/execute`,
        { steps },
        {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "x-copilot-token": token } : {})
          },
          timeout: 30_000
        }
      );
      return (res.data?.results ?? []) as AutomationResult[];
    } catch (err) {
      // Fall back to local execution (usually dry-run in Docker).
      console.error("AUTOMATION_ENDPOINT failed, falling back to local execution:", err);
    }
  }

  const results: AutomationResult[] = [];
  for (const step of steps) results.push(await executeTool(step));
  return results;
}
