import { env } from "../config/env.js";
import { createMeetingStore } from "./meeting-store.service.js";
import { createPostgresMeetingStore } from "../db/db-meeting-store.js";
import { getPool } from "../db/db.js";

function getMeetingStore() {
  // Try to use PostgreSQL if enabled and available
  if (env.USE_DATABASE === "true") {
    try {
      const pool = getPool();
      if (pool) {
        console.log("📊 Using PostgreSQL for meeting storage");
        return createPostgresMeetingStore();
      }
    } catch (err) {
      console.warn("⚠️  PostgreSQL not available, falling back to file-based storage");
    }
  }

  // Fall back to file-based storage
  console.log("📁 Using file-based storage for meetings");
  return createMeetingStore(env.MEETINGS_DIR);
}

export const meetingStore = getMeetingStore();

