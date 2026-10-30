const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { bootstrap } = require('../scripts/postgres-bootstrap.cjs');
const { claimJob, videoInfo, conversionArgs } = require('../scripts/video-worker.cjs');
const fs = require('node:fs');
const ts = require('typescript');

function videoApi(db) {
  const mod = { exports: {} };
  class DataError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
  const deps = {
    '@/lib/api-server': { requireAdmin: async () => {}, readJson: request => request.json(), apiError: error => Response.json({ error: error.message }, { status: error.status || 500 }) },
    '@/lib/cloud-validation': { DataError },
    '@/lib/postgres': { pgQuery: (sql, values) => db.query(sql, values) },
    '@/lib/r2-storage': { r2Enabled: () => true },
  };
  new Function('require', 'exports', 'module', ts.transpileModule(fs.readFileSync(require.resolve('../app/api/admin/video/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => deps[name] || require(name), mod.exports, mod);
  return action => mod.exports.POST(new Request('https://example.com/api/admin/video', { method: 'POST', body: JSON.stringify(action) }));
}

test('video queue survives worker interruption, claims once and protects data from public roles', async () => {
  const db = new PGlite(); await db.waitReady;
  const client = { query: async (sql, values) => !values && sql.includes(';') ? (await db.exec(sql)).at(-1) : db.query(sql, values) };
  try {
    await bootstrap(client, 'a'.repeat(64));
    await db.exec('set role hl_app');
    const id = '10000000-0000-4000-8000-000000000001';
    await db.query("insert into video_jobs(id,input_key,output_key,filename,input_size,status) values($1,'input','output','phone.mov',524288000,'queued')", [id]);
    const job = await claimJob(client);
    assert.equal(job.id, id); assert.equal(job.attempts, 1);
    assert.equal(await claimJob(client), undefined);
    const previous = { DATABASE_URL: process.env.DATABASE_URL, MEDIA_PUBLIC_URL: process.env.MEDIA_PUBLIC_URL };
    process.env.DATABASE_URL = 'test'; process.env.MEDIA_PUBLIC_URL = 'https://media.example.com';
    try {
      const api = videoApi(db);
      assert.equal((await api({ action: 'dismiss', id })).status, 409);
      await db.query("update video_jobs set status='ready' where id=$1", [id]);
      assert.equal((await (await api({ action: 'recent' })).json()).jobs.length, 1);
      assert.equal((await api({ action: 'dismiss', id })).status, 200);
      assert.equal((await api({ action: 'dismiss', id })).status, 200);
      assert.equal((await (await api({ action: 'recent' })).json()).jobs.length, 0);
      assert.equal((await (await api({ action: 'status', id })).json()).publicUrl, 'https://media.example.com/output');
      const retained = (await db.query('select input_key,output_key,input_deleted from video_jobs where id=$1', [id])).rows[0];
      assert.deepEqual(retained, { input_key: 'input', output_key: 'output', input_deleted: false });
      await db.query("update video_jobs set status='processing' where id=$1", [id]);
    } finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
    await db.query("update video_jobs set updated_at=now()-interval '3 minutes' where id=$1", [id]);
    assert.equal((await claimJob(client)).attempts, 2);
    await db.query("update video_jobs set attempts=3,updated_at=now()-interval '3 minutes' where id=$1", [id]);
    assert.equal(await claimJob(client), undefined);
    assert.equal((await db.query('select status from video_jobs')).rows[0].status, 'failed');
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from video_jobs'), /permission denied/);
  } finally { await db.close(); }
});
test('conversion rejects audio-only, excessive duration and oversized decoded frames', () => {
  const data = { streams: [{ index: 0, codec_type: 'video', width: 1080, height: 1920, avg_frame_rate: '60/1' }], format: { duration: '4' } };
  const args = conversionArgs('input', 'output', data);
  assert.ok(args.includes('libx264')); assert.ok(args.includes('+faststart'));
  assert.match(args[args.indexOf('-vf') + 1], /fps=30/);
  assert.doesNotMatch(args[args.indexOf('-vf') + 1], /crop/);
  for (const invalid of [{ streams: [] }, { ...data, format: { duration: '1801' } }, { ...data, streams: [{ ...data.streams[0], width: 20000 }] }]) assert.throws(() => videoInfo(invalid));
});
