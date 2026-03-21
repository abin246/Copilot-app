import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "../db/db.js";
import { env } from "../config/env.js";

const JWT_SECRET = env.JWT_SECRET || "your-secret-key-change-this";
const JWT_EXPIRY = "7d";

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthToken {
  token: string;
  user: User;
}

// Register user
export async function registerUser(
  email: string,
  password: string,
  name: string
): Promise<AuthToken> {
  const pool = getPool();
  if (!pool) throw new Error("Database not initialized");

  // Check if user exists
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);
  if (existing.rows.length > 0) {
    throw new Error("Email already registered");
  }

  // Hash password
  const passwordHash = await bcryptjs.hash(password, 10);

  // Insert user
  const result = await pool.query(
    "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
    [email, passwordHash, name]
  );

  const user = result.rows[0];
  const token = createToken(user);

  return { token, user };
}

// Login user
export async function loginUser(
  email: string,
  password: string
): Promise<AuthToken> {
  const pool = getPool();
  if (!pool) throw new Error("Database not initialized");

  // Find user
  const result = await pool.query(
    "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];

  // Verify password
  const validPassword = await bcryptjs.compare(password, user.password_hash);
  if (!validPassword) {
    throw new Error("Invalid email or password");
  }

  const token = createToken({ id: user.id, email: user.email, name: user.name });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name },
  };
}

// Create JWT token
function createToken(user: any): string {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

// Verify token
export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Get user from token
export async function getUserFromToken(token: string): Promise<User | null> {
  const decoded = verifyToken(token);
  if (!decoded) return null;

  const pool = getPool();
  if (!pool) return null;

  const result = await pool.query(
    "SELECT id, email, name FROM users WHERE id = $1",
    [decoded.userId]
  );

  return result.rows[0] || null;
}
