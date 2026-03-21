import type { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../services/auth.service.js";

export interface AuthRequest extends Request {
  user?: { id: number; email: string };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const token = authHeader.slice(7);
    const user = await getUserFromToken(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = { id: user.id, email: user.email };
    next();
  } catch (err) {
    res.status(500).json({ error: "Auth error" });
  }
}

// Optional middleware - doesn't fail if no token
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const user = await getUserFromToken(token);
      if (user) {
        req.user = { id: user.id, email: user.email };
      }
    }
  } catch (err) {
    // Silently fail - the request can still proceed
  }
  next();
}
