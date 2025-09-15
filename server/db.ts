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

// Database readiness state
let isDbReady = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Function to check database connection health with retry logic
export async function checkDatabaseConnection(): Promise<boolean> {
  const now = Date.now();
  
  // Use cached result if recent
  if (now - lastHealthCheck < 5000 && isDbReady) {
    return true;
  }
  
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      isDbReady = true;
      lastHealthCheck = now;
      if (attempt > 0) {
        console.log(`Database connection restored after ${attempt + 1} attempts`);
      }
      return true;
    } catch (error) {
      isDbReady = false;
      lastHealthCheck = now;
      
      if (attempt === maxRetries - 1) {
        console.error(`Database connection failed after ${maxRetries} attempts:`, error);
        return false;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(`Database connection attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return false;
}

// Function to get current database readiness state
export function isDatabaseReady(): boolean {
  return isDbReady;
}

// Periodic database health check
function startPeriodicHealthCheck() {
  const healthCheckInterval = setInterval(async () => {
    try {
      await checkDatabaseConnection();
    } catch (error) {
      console.error('Periodic health check error:', error);
    }
  }, HEALTH_CHECK_INTERVAL);
  
  // Clear interval on process exit
  process.on('SIGTERM', () => clearInterval(healthCheckInterval));
  process.on('SIGINT', () => clearInterval(healthCheckInterval));
  
  return healthCheckInterval;
}

// Start periodic health checks
startPeriodicHealthCheck();