import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// This allows us to use standard connection string or Supabase connection pooling string
const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode.
// In serverless environments like Vercel, limit max connections per container to prevent pool exhaustion.
const client = postgres(connectionString, {
  prepare: false,
  max: process.env.NODE_ENV === 'production' ? 1 : 5,
});
export const db = drizzle(client, { schema });
