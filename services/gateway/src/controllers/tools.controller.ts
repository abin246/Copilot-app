import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { executeSteps } from "../services/windows-automation.service.js";
import type { ToolCall } from "../agents/planner.agent.js";

const toolSchema = z.discriminatedUnion("tool", [
  z.object({ tool: z.literal("open_app"), app: z.string().min(1) }),
  z.object({ tool: z.literal("type_text"), text: z.string().min(1) }),
  z.object({ tool: z.literal("paste_text"), text: z.string().min(1) }),
  z.object({ tool: z.literal("press_keys"), keys: z.string().min(1) }),
  z.object({ tool: z.literal("wait_ms"), ms: z.number().int().min(0).max(120_000) }),
  z.object({
    tool: z.literal("click"),
    x: z.number().int().optional(),
    y: z.number().int().optional(),
    button: z.enum(["left", "right"]).optional()
  }),
  z.object({ tool: z.literal("move_mouse"), x: z.number().int(), y: z.number().int() })
]);

const executeSchema = z.object({
  steps: z.array(toolSchema).min(1)
});

function requireAutomationToken(req: Request): boolean {
  const token = process.env.AUTOMATION_TOKEN;
  if (!token) return true; // dev-friendly default
  const got = req.header("x-copilot-token");
  return got === token;
}

export async function executeToolsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireAutomationToken(req)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const parsed = executeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_body", details: parsed.error.format() });
    }

    const steps = parsed.data.steps as ToolCall[];
    const results = await executeSteps(steps);

    res.json({ ok: results.every((r) => r.ok), results });
  } catch (err) {
    next(err);
  }
}
