import http from "node:http";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const port = Number.parseInt(process.env.PORT || "4010", 10);
const mode = process.env.AUTOMATION_MODE || "dry-run"; // dry-run | live
const token = process.env.AUTOMATION_TOKEN || "";
const pwsh = process.env.POWERSHELL_EXE || "powershell.exe";

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.url === "/health") {
        return json(res, 200, { status: "ok", service: "desktop-client", mode });
      }

      if (req.url === "/meeting-windows" && req.method === "GET") {
        if (token && req.headers["x-copilot-token"] !== token) {
          return json(res, 401, { error: "unauthorized" });
        }
        const windows = await detectMeetingWindows();
        return json(res, 200, { windows });
      }

      if (req.url === "/execute" && req.method === "POST") {
        if (token && req.headers["x-copilot-token"] !== token) {
          return json(res, 401, { error: "unauthorized" });
        }

        const body = await readJson(req);
        const steps = Array.isArray(body?.steps) ? body.steps : null;
        if (!steps || steps.length === 0) {
          return json(res, 400, { error: "invalid_body" });
        }

        const results = [];
        for (const step of steps) {
          results.push(await executeTool(step));
        }

        return json(res, 200, { ok: results.every((r) => r.ok), results });
      }

      return json(res, 404, { error: "not_found" });
    } catch (e) {
      return json(res, 500, { error: String(e) });
    }
  });
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (buf += chunk));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function detectMeetingWindows() {
  const psScript = [
    "$items = Get-Process | Where-Object { $_.MainWindowTitle -and ($_.ProcessName -match 'zoom|teams|ms-teams|chrome|msedge') } | Select-Object ProcessName, MainWindowTitle, Id",
    "if ($null -eq $items) { '[]' } else { $items | ConvertTo-Json -Compress }",
  ].join("; ");

  const raw = await new Promise((resolve) => {
    const child = spawn(pwsh, ["-NoProfile", "-NonInteractive", "-Command", psScript], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", () => resolve("[]"));
    child.on("exit", () => resolve(stdout.trim() || "[]"));
  });

  let parsed = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .map((row) => ({
      processName: String(row?.ProcessName || ""),
      title: String(row?.MainWindowTitle || "").trim(),
      pid: Number(row?.Id || 0),
    }))
    .filter((row) => row.processName && row.title);
}

function escapePsSingleQuoted(s) {
  return String(s).replace(/'/g, "''");
}

export function toSendKeys(keys) {
  const k = String(keys || "").trim().toLowerCase();
  if (k === "enter") return "{ENTER}";
  if (k === "tab") return "{TAB}";
  if (k === "escape" || k === "esc") return "{ESC}";
  const ctrl = k.match(/^ctrl\s*\+\s*([a-z0-9])$/);
  if (ctrl?.[1]) return `^${ctrl[1]}`;
  return String(keys || "");
}

export function buildCommand(step) {
  if (!step || typeof step !== "object") return "";
  switch (step.tool) {
    case "open_app":
      return `Start-Process '${escapePsSingleQuoted(step.app)}'`;
    case "type_text":
      return `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${escapePsSingleQuoted(step.text)}')`;
    case "paste_text":
      return [
        `Set-Clipboard -Value '${escapePsSingleQuoted(step.text)}'`,
        `$ws = New-Object -ComObject WScript.Shell`,
        `$ws.SendKeys('^v')`,
      ].join("; ");
    case "press_keys":
      return `$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('${escapePsSingleQuoted(toSendKeys(step.keys))}')`;
    case "wait_ms":
      return `Start-Sleep -Milliseconds ${Math.max(0, Math.trunc(step.ms))}`;
    case "move_mouse":
      return `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.trunc(step.x)}, ${Math.trunc(step.y)})`;
    case "click": {
      const x = step.x != null ? Math.trunc(step.x) : null;
      const y = step.y != null ? Math.trunc(step.y) : null;
      const move =
        x != null && y != null
          ? `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y}); `
          : "";
      const mouse = [
        'Add-Type -Namespace Win32 -Name Mouse -MemberDefinition @\'',
        '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);',
        '@\'',
        "$down = 0x0002; $up = 0x0004",
        "[Win32.Mouse]::mouse_event($down,0,0,0,0); [Win32.Mouse]::mouse_event($up,0,0,0,0)",
      ].join("; ");
      return move + mouse;
    }
    default:
      return "";
  }
}

export async function executeTool(step) {
  const command = buildCommand(step);
  if (!command) return { ok: false, mode, tool: step?.tool || "unknown", command: "", error: "invalid_step" };

  if (mode !== "live") {
    return { ok: true, mode: "dry-run", tool: step.tool, command };
  }

  return await new Promise((resolve) => {
    const child = spawn(pwsh, ["-NoProfile", "-NonInteractive", "-Command", command], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => resolve({ ok: false, mode: "live", tool: step.tool, command, error: String(err) }));
    child.on("exit", (code) => {
      if (code === 0) return resolve({ ok: true, mode: "live", tool: step.tool, command });
      resolve({ ok: false, mode: "live", tool: step.tool, command, error: stderr || `exit ${code}` });
    });
  });
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  createServer().listen(port, () => {
    console.log(`desktop-client listening on ${port} (mode=${mode})`);
  });
}
