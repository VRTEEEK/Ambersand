import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure pool with better error handling and connection management
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
};

export const pool = new Pool(poolConfig);

// Add error event handling for the pool
pool.on('error', (err) => {
  console.error('Database pool error:', err);
  // Don't throw here, just log the error to prevent crashes
});

export const db = drizzle({ client: pool, schema });

// Function to check database connection health
export async function checkDatabaseConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('Database connection healthy');
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}