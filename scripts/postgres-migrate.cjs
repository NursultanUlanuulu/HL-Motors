// Run as the migration owner, never as the web application login.
// Reuses the tested SQL schema; compatibility storage.buckets is metadata only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
async function migrate(client) {
  await client.query('select pg_advisory_lock(2076582761, 2)');
  try {
    await client.query(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    end $$;
    create schema if not exists storage;
    create table if not exists storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table if not exists public.hl_schema_migrations(name text primary key, checksum text not null, applied_at timestamptz not null default now());`);
    const directory = path.join(__dirname, '../supabase/migrations');
    for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      const sql = fs.readFileSync(path.join(directory, name), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
      const applied = await client.query('select checksum from public.hl_schema_migrations where name=$1', [name]);
      if (applied.rows.length) {
        if (applied.rows[0].checksum !== checksum) throw new Error('Applied migration changed: ' + name);
        continue;
      }
      await client.query('begin');
      try {
        // Outer transaction includes both migration and its ledger record.
        await client.query(sql.replace(/^begin;\s*$/gmi, '').replace(/^commit;\s*$/gmi, ''));
        await client.query('insert into public.hl_schema_migrations(name,checksum) values($1,$2)', [name, checksum]);
        await client.query('commit');
      } catch (error) { await client.query('rollback'); throw error; }
      console.log('Applied', name);
    }
    // A restricted app login inherits service_role privileges. It does not need BYPASSRLS.
    for (const table of ['vehicles', 'site_settings', 'admin_sessions']) {
      await client.query(`drop policy if exists hl_server_access on public.${table};
        create policy hl_server_access on public.${table} to service_role using(true) with check(true)`);
    }
  } finally { await client.query('select pg_advisory_unlock(2076582761, 2)'); }
}
module.exports = { migrate };
if (require.main === module) {
  (async () => {
    const client = new Client({ connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    await client.connect();
    try { await migrate(client); } finally { await client.end(); }
  })().catch(() => { console.error('Migration failed. Check database access and migration checksums.'); process.exitCode = 1; });
}
