import http from "http";
import app from "./app.js";
import { env } from "./config/env.js";
import { initializePool, testConnection, closePool } from "./db/db.js";
import { initializeDatabase } from "./db/init-db.js";
import { startAutoMeetingMonitor, stopAutoMeetingMonitor } from "./services/meeting-auto.service.js";
import { initWebSocket } from "./websocket/websocket.server.js";

const server = http.createServer(app);

initWebSocket(server);

async function start() {
  try {
    if (env.USE_DATABASE === "true") {
      console.log("Initializing database connection...");
      initializePool(env.DATABASE_URL);

      const connected = await testConnection();
      if (!connected) {
        console.warn("Database connection failed. Falling back to file-based storage.");
      } else {
        await initializeDatabase();
      }
    }

    server.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });

    startAutoMeetingMonitor();

    process.on("SIGINT", async () => {
      console.log("Shutting down gracefully...");
      stopAutoMeetingMonitor();
      await closePool();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("Received SIGTERM, shutting down gracefully...");
      stopAutoMeetingMonitor();
      await closePool();
      process.exit(0);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
