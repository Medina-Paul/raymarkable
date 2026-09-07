import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load .env.local if present, then fallback to standard .env
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
