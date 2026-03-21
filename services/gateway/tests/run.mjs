import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { createMeetingStore } from "../dist/services/meeting-store.service.js";
import { planFromTranscript } from "../dist/agents/planner.agent.js";
import { executeTool, executeSteps } from "../dist/services/windows-automation.service.js";

async function testMeetingStore() {
  const tmp = path.join(process.cwd(), "tests", ".tmp-meetings");
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });

  const store = createMeetingStore(tmp);

  await store.appendMeetingEvent("sess-1", { ts: 1, type: "session", sessionId: "sess-1" });
  await store.appendMeetingEvent("sess-1", { ts: 2, type: "transcript", text: "hello" });
  await store.appendMeetingEvent("sess-1", { ts: 3, type: "ai", text: "world" });

  const meetings = await store.listMeetings();
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0].sessionId, "sess-1");

  const events = await store.readMeeting("sess-1");
  assert.equal(events.length, 3);
  assert.equal(events[0].type, "session");
  assert.equal(events[1].type, "transcript");
  assert.equal(events[2].type, "ai");
}

async function main() {
  await testMeetingStore();
  const plan = planFromTranscript('open notepad and type "hello"');
  assert.ok(plan);
  assert.ok(plan.steps.length >= 1);

  process.env.AUTOMATION_MODE = "dry-run";
  const res = await executeTool({ tool: "open_app", app: "notepad" });
  assert.equal(res.ok, true);
  assert.equal(res.mode, "dry-run");
  assert.equal(res.tool, "open_app");

  const res2 = await executeSteps([{ tool: "open_app", app: "notepad" }]);
  assert.equal(Array.isArray(res2), true);
  assert.equal(res2.length, 1);
  assert.equal(res2[0].ok, true);
  console.log("OK: tests passed");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
