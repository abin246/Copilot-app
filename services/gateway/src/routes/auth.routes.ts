import express from "express";
import type { Request, Response } from "express";
import { registerUser, loginUser } from "../services/auth.service.js";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { token, user } = await registerUser(email, password, name || email);
    res.status(201).json({ token, user });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const { token, user } = await loginUser(email, password);
    res.json({ token, user });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/me (protected)
router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
