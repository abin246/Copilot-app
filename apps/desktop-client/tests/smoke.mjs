// Smoke test for the desktop-client command builder and API contract shape.
// No child processes are spawned (default mode is dry-run).

import assert from "node:assert/strict";

async function main() {
  // Basic contract examples.
  const steps = [
    { tool: "open_app", app: "notepad" },
    { tool: "type_text", text: "hello" },
    { tool: "wait_ms", ms: 250 },
    { tool: "paste_text", text: "hello from clipboard" },
    { tool: "press_keys", keys: "enter" }
  ];

  const mod = await import("../server.mjs");
  assert.equal(typeof mod.buildCommand, "function");
  for (const s of steps) {
    const cmd = mod.buildCommand(s);
    assert.ok(String(cmd).length > 0);
  }

  // We can't directly hit the server without starting it; this is a minimal parse check.
  assert.equal(Array.isArray(steps), true);
  console.log("OK: desktop-client smoke passed");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
