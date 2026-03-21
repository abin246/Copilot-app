import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type MeetingEvent =
  | { ts: number; type: "session"; sessionId: string }
  | { ts: number; type: "transcript"; text: string }
  | { ts: number; type: "ai"; text: string }
  | { ts: number; type: "error"; message: string };

export type MeetingListItem = { sessionId: string; updatedAt: number; bytes: number };

function safeSessionId(sessionId: string): string {
  // Prevent path traversal and weird filenames.
  return sessionId.replace(/[^a-zA-Z0-9-_:.]/g, "");
}

export function createMeetingStore(meetingsDir: string) {
  const dataDir = path.resolve(process.cwd(), meetingsDir);

  function sessionFile(sessionId: string): string {
    return path.join(dataDir, `${safeSessionId(sessionId)}.jsonl`);
  }

  async function ensure(): Promise<void> {
    await mkdir(dataDir, { recursive: true });
  }

  async function appendMeetingEvent(sessionId: string, event: MeetingEvent): Promise<void> {
    await ensure();
    await appendFile(sessionFile(sessionId), JSON.stringify(event) + "\n", "utf8");
  }

  async function listMeetings(): Promise<MeetingListItem[]> {
    await ensure();
    const files = await readdir(dataDir);
    const meetings: MeetingListItem[] = [];

    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const sessionId = f.slice(0, -".jsonl".length);
      const st = await stat(path.join(dataDir, f));
      meetings.push({ sessionId, updatedAt: st.mtimeMs, bytes: st.size });
    }

    meetings.sort((a, b) => b.updatedAt - a.updatedAt);
    return meetings;
  }

  async function readMeeting(sessionId: string): Promise<MeetingEvent[]> {
    await ensure();
    const content = await readFile(sessionFile(sessionId), "utf8");
    const events: MeetingEvent[] = [];

    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // ignore malformed lines
      }
    }

    return events;
  }

  return { appendMeetingEvent, listMeetings, readMeeting };
}

