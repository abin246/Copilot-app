import express from "express";
import cors from "cors";
import helmet from "helmet";
import copilotRoutes from "./routes/copilot.routes.js";
import meetingRoutes from "./routes/meeting.routes.js";
import toolsRoutes from "./routes/tools.routes.js";
import modelsRoutes from "./routes/models.routes.js";
import authRoutes from "./routes/auth.routes.js";
import meetingAutoRoutes from "./routes/meeting-auto.routes.js";
import { optionalAuthMiddleware } from "./middleware/auth.middleware.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(optionalAuthMiddleware);

app.use("/api/auth", authRoutes);
app.use("/api/copilot", copilotRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/meeting-auto", meetingAutoRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/models", modelsRoutes);

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

app.use((req, res) => {
  res.status(404).json({
    error: "not_found",
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

app.use(errorMiddleware);

export default app;
