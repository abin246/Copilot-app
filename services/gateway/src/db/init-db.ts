import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPool } from "./db.js";

async function runSchema(client: any, schemaPath: string): Promise<void> {
  const schema = readFileSync(schemaPath, "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await client.query(statement);
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    const client = await getPool().connect();
    try {
      console.log("Running database schema initialization...");
      
      // Run main schema
      await runSchema(client, resolve(process.cwd(), "src/db/schema.sql"));
      
      // Run auth schema
      await runSchema(client, resolve(process.cwd(), "src/db/auth-schema.sql"));

      console.log("✓ Database schema initialized successfully");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("✗ Failed to initialize database schema:", err);
    throw err;
  }
}
