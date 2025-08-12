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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create a logging wrapper for the database
const originalDb = drizzle({ client: pool, schema });
export const db = new Proxy(originalDb, {
  get(target, prop) {
    if (prop === 'insert') {
      return function(table: any) {
        console.log('💾💾💾 DB.INSERT called on table:', table[Symbol.for('drizzle:Name')] || 'unknown');
        return target.insert(table);
      };
    }
    return target[prop as keyof typeof target];
  }
});