// Applies frontend/db/schema.sql to the configured database (idempotent).
// Uses the direct (non-pooled) connection when available, which is recommended for schema changes.
// Run: node db/migrate.mjs            (from frontend/; reads .env.local)

import './env.mjs';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!url) {
  console.error('No POSTGRES_URL_NON_POOLING or POSTGRES_URL in the environment.');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, ssl: 'require', max: 1 });
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
try {
  await sql.unsafe(schema);
  const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`;
  const rls = await sql`select relname from pg_class where relrowsecurity and relnamespace = 'public'::regnamespace order by 1`;
  console.log('tables:', tables.map((t) => t.table_name).join(', '));
  console.log('RLS on:', rls.length, 'of', tables.length);
} finally {
  await sql.end();
}
