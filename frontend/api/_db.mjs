// Shared Postgres connection for TempoFlow's server functions (Supabase transaction pooler).
// Prefers POSTGRES_URL (set by the Vercel ↔ Supabase integration), then DATABASE_URL.

import postgres from 'postgres';

const PLACEHOLDER = /\.\.\.\.|\[YOUR-PASSWORD\]|yourpassword|xxxx/i;

export function databaseUrl() {
  for (const name of ['POSTGRES_URL', 'DATABASE_URL']) {
    const value = process.env[name];
    if (value && !PLACEHOLDER.test(value)) return value;
  }
  return null;
}

let sql;
/** Returns a postgres.js client, or null when no database is configured. */
export function db() {
  if (sql) return sql;
  const url = databaseUrl();
  if (!url) return null;
  // Transaction pooler: no prepared statements; small pool per serverless instance.
  sql = postgres(url, { prepare: false, ssl: 'require', max: 3, idle_timeout: 20, connect_timeout: 10 });
  return sql;
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v)), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

export function requireDb() {
  const sql = db();
  if (!sql) throw Object.assign(new Error('The database is not configured on this deployment.'), { status: 503 });
  return sql;
}

/** Wraps a handler so thrown errors become JSON responses with their status (default 500, message hidden). */
export const handler = (fn) => async (request) => {
  try {
    return await fn(request);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(e);
    return json({ error: status >= 500 && !e.status ? 'Server error' : e.message }, status);
  }
};

export const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
export const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a);
