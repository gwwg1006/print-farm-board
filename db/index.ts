import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Vercel Neon 데이터베이스가 연결되지 않았습니다. DATABASE_URL을 설정해 주세요.");
  return url;
}

let schemaReady: Promise<void> | undefined;

export function ensureJobsTable() {
  if (!schemaReady) {
    const sql = neon(databaseUrl());
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id SERIAL PRIMARY KEY,
        screenshot TEXT NOT NULL DEFAULT '',
        printer TEXT NOT NULL,
        model_name TEXT NOT NULL,
        file_name TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL DEFAULT 1,
        completed_quantity INTEGER NOT NULL DEFAULT 0,
        material TEXT NOT NULL DEFAULT 'PLA',
        color TEXT NOT NULL DEFAULT 'White',
        nozzle TEXT NOT NULL DEFAULT '0.4 mm',
        estimated_time TEXT NOT NULL DEFAULT '',
        print_settings TEXT NOT NULL DEFAULT '0.20 mm Standard',
        customer TEXT NOT NULL DEFAULT '',
        operator TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'waiting',
        priority TEXT NOT NULL DEFAULT 'normal',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `.then(() => undefined).catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

export function getDb() {
  return drizzle(neon(databaseUrl()), { schema });
}
