import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export function initializePool(connectionString: string): Pool {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });

  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("Database pool not initialized. Call initializePool first.");
  }
  return pool;
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    console.log("✓ Database connection successful:", result.rows[0]);
    return true;
  } catch (err) {
    console.error("✗ Database connection failed:", err);
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}
