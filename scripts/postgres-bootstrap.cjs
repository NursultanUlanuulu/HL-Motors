const { Client } = require('pg');
const { migrate } = require('./postgres-migrate.cjs');

async function bootstrap(client, password) {
  if (!/^[a-f0-9]{64,128}$/.test(password || '')) throw new Error('Use a random hex application database password.');
  await migrate(client);
  await client.query('begin');
  try {
    await client.query("do $$ begin if not exists(select 1 from pg_roles where rolname='hl_app') then create role hl_app login; end if; end $$");
    const { rows } = await client.query("select format('alter role hl_app with login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password %L', $1::text) as sql", [password]);
    await client.query(rows[0].sql);
    await client.query('grant service_role to hl_app');
    await client.query('commit');
  } catch (error) { await client.query('rollback'); throw error; }
}

module.exports = { bootstrap };
if (require.main === module) {
  (async () => {
    const client = new Client({ connectionTimeoutMillis: 5000 });
    await client.connect();
    try { await bootstrap(client, process.env.APP_DATABASE_PASSWORD); }
    finally { await client.end(); }
    console.log('Database ready. No vehicles were imported.');
  })().catch(() => { console.error('Database bootstrap failed. Check configuration and schema.'); process.exitCode = 1; });
}
