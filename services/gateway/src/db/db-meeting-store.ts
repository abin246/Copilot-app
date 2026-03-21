import { getPool, withClient } from "./db.js";

export type MeetingEvent =
  | { ts: number; type: "session"; sessionId: string }
  | { ts: number; type: "transcript"; text: string }
  | { ts: number; type: "ai"; text: string }
  | { ts: number; type: "error"; message: string };

export type MeetingEventWithId = MeetingEvent & { id: number };

export type MeetingListItem = {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  durationSeconds: number | null;
};

export interface MeetingStore {
  appendMeetingEvent(sessionId: string, event: MeetingEvent): Promise<void>;
  listMeetings(): Promise<MeetingListItem[]>;
  readMeeting(sessionId: string): Promise<MeetingEvent[]>;
}

export function createPostgresMeetingStore(): MeetingStore {
  return {
    async appendMeetingEvent(sessionId: string, event: MeetingEvent): Promise<void> {
      await withClient(async (client) => {
        // Get or create meeting
        let meetingId = await client
          .query("SELECT id FROM meetings WHERE session_id = $1", [sessionId])
          .then((res) => res.rows[0]?.id);

        if (!meetingId) {
          const res = await client.query(
            "INSERT INTO meetings (session_id) VALUES ($1) RETURNING id",
            [sessionId]
          );
          meetingId = res.rows[0].id;
        }

        // Insert event
        const eventText = event.type === "transcript" ? (event as any).text : 
                         event.type === "ai" ? (event as any).text :
                         event.type === "error" ? (event as any).message : null;

        await client.query(
          `INSERT INTO meeting_events (meeting_id, event_type, event_text, event_data)
           VALUES ($1, $2, $3, $4)`,
          [meetingId, event.type, eventText, JSON.stringify(event)]
        );

        // Update meeting's updated_at
        await client.query("UPDATE meetings SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [
          meetingId,
        ]);
      });
    },

    async listMeetings(): Promise<MeetingListItem[]> {
      const result = await getPool().query(
        `SELECT 
          session_id,
          EXTRACT(EPOCH FROM created_at)::int * 1000 as created_at,
          EXTRACT(EPOCH FROM updated_at)::int * 1000 as updated_at,
          duration_seconds
         FROM meetings
         ORDER BY updated_at DESC
         LIMIT 100`
      );

      return result.rows.map((row) => ({
        sessionId: row.session_id,
        createdAt: parseInt(row.created_at),
        updatedAt: parseInt(row.updated_at),
        durationSeconds: row.duration_seconds,
      }));
    },

    async readMeeting(sessionId: string): Promise<MeetingEvent[]> {
      const result = await getPool().query(
        `SELECT event_data, created_at
         FROM meeting_events
         WHERE meeting_id = (SELECT id FROM meetings WHERE session_id = $1)
         ORDER BY created_at ASC`,
        [sessionId]
      );

      return result.rows.map((row) => {
        const data = row.event_data;
        return {
          ts: new Date(row.created_at).getTime(),
          ...data,
        };
      });
    },
  };
}
