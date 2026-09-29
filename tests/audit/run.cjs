const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createHmac } = require('node:crypto');
const { chromium } = require('./runtime/node_modules/playwright');
const { root, origin, dbOrigin, sessionSecret, serviceKey, load, synthetic, database, adapter } = require('./harness.cjs');
const evidence = path.join(__dirname, 'evidence'); fs.mkdirSync(evidence, { recursive: true });
const results = [];
async function check(name, fn) {
  try { const details = await fn(); results.push({ name, completed: true, details }); console.log('DONE', name, JSON.stringify(details)); }
  catch (err) { results.push({ name, completed: false, error: err.message }); console.log('INCOMPLETE', name, err.message); }
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2));
}
const pause = ms => new Promise(r => setTimeout(r, ms));
function token(user, expires) { const payload = `${user}:${expires}:audit-nonce`; return `${payload}.${createHmac('sha256', sessionSecret).update(payload).digest('hex')}`; }
let cookie = '';
let loginRequest;
async function api(endpoint, body, options = {}) {
  const response = await fetch(origin + endpoint, { method: options.method || (body === undefined ? 'GET' : 'POST'), redirect: 'manual', signal: AbortSignal.timeout(options.timeout || 26000), headers: { Origin: origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...options.headers }, body: body === undefined ? undefined : options.raw ? body : JSON.stringify(body) });
  const text = await response.text(); let value; try { value = JSON.parse(text); } catch { value = text.slice(0,200); }
  return { status: response.status, body: value, location: response.headers.get('location'), cacheControl: response.headers.get('cache-control') };
}
async function main() {
  // Refuse to attach to an unrelated pre-existing local application.
  await new Promise((resolve,reject)=>{const probe=require('node:net').createServer();probe.once('error',reject);probe.listen(3107,'127.0.0.1',()=>probe.close(resolve));});
  const db = await database(); const { state, server } = await adapter(db);
  let child, browser;
  const log = fs.openSync(path.join(evidence, 'server.log'), 'w');
  try {
    // Explicit values override .env.local; no real integration keys are used.
    child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', '3107', '-H', '127.0.0.1'], { cwd: root, windowsHide: true, env: { ...process.env, SUPABASE_URL: dbOrigin, SUPABASE_SECRET_KEY: serviceKey, ADMIN_SESSION_SECRET: sessionSecret, ADMIN_PASSWORD: '', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', log, log] });
    child.on('error', e => console.error(e.message));
    for (let i=0; i<80; i++) { try { if ((await fetch(origin + '/login')).ok) break; } catch {} await pause(250); if (i===79) throw new Error('Isolated Next server did not start'); }
    console.log('ISOLATION', origin, dbOrigin, 'PGlite in-memory; no external requests allowed in browser');
    await check('loopback IP origin is rejected because NextRequest normalizes host', async () => {
      const r=await fetch('http://127.0.0.1:3107/api/admin/vehicles',{method:'POST',headers:{Origin:'http://127.0.0.1:3107','content-type':'application/json'},body:'{}'});
      const canonical=await api('/api/admin/vehicles',{});assert.equal(r.status,403);assert.equal(canonical.status,401);
      return {finding:'F04',ipOrigin:{status:r.status,body:await r.json()},canonicalOrigin:canonical.status};
    });
    await check('anonymous writes, cross-origin and missing origin', async () => {
      const statuses = [];
      for (const [endpoint, method] of [['vehicles','POST'],['vehicles','DELETE'],['contacts','POST'],['media','POST']]) {
        const r = await api('/api/admin/'+endpoint, {}, { method }); assert.equal(r.status,401); statuses.push({ endpoint, method, status:r.status });
      }
      for (const originHeader of ['http://untrusted.invalid', 'null', '']) { const r=await api('/api/admin/vehicles', {}, { headers:{ Origin:originHeader } }); assert.equal(r.status,403); statuses.push({ origin:originHeader,status:r.status }); }
      const r = await api('/admin/vehicles'); assert.equal(r.location,'/login');
      return { statuses, adminPage: r.status, databaseRows:(await db.query('select count(*) from vehicles')).rows };
    });
    await check('real SQL permissions for anon and two authenticated principals', async () => {
      const out=[];
      for (const role of ['anon','audit_user_a','audit_user_b']) for (const table of ['vehicles','site_settings']) for (const operation of ['select','insert','update','delete']) {
        const statement = operation==='select' ? `select * from ${table}` : operation==='delete' ? `delete from ${table}` : operation==='update' ? `update ${table} set id=id` : table==='vehicles' ? `insert into vehicles(id,data) values('DENIED','{}')` : `insert into site_settings(id,contacts) values('main','{}')`;
        await db.exec(`set role ${role}`); let code;
        try { await db.exec(statement); } catch(e) { code=e.code; } finally { await db.exec('reset role'); }
        assert.equal(code,'42501'); out.push({ role,table,operation,code });
      }
      return { engine:'PGlite PostgreSQL, exact migration; not Supabase JWT/RLS REST validation', operations:out };
    });
    browser = await chromium.launch({ channel: 'msedge', headless:true });
    const context = await browser.newContext({ viewport:{width:1440,height:1000} });
    // All browser traffic is confined to our own application. No fonts, photos or messenger requests leave the machine.
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('request',request=>{if(request.method()==='POST'&&request.url()===origin+'/login')loginRequest={headers:request.headers(),body:request.postDataBuffer()};});
    await check('default admin password grants actual production session', async () => {
      await page.goto(origin+'/login');
      await page.getByRole('textbox',{name:'Логин',exact:true}).fill('admin');
      await page.locator('input[name=password]').fill('123456!');
      await page.getByRole('button',{name:'Войти',exact:true}).click();
      await page.waitForURL('**/admin/vehicles');
      const c=(await context.cookies()).find(c=>c.name==='hl-admin-session'); assert.ok(c); cookie=`${c.name}=${c.value}`;
      return { finding:'F01', url:page.url(), cookie:{httpOnly:c.httpOnly,secure:c.secure,sameSite:c.sameSite,ttlSeconds:Math.round(c.expires-Date.now()/1000)}, passwordConfiguration:'empty, production mode', sessionValue:'REDACTED' };
    });
    await check('tampered, expired and non-admin signed sessions rejected', async () => {
      const old=cookie; const statuses=[];
      for (const [label,value] of [['tampered',old.slice('hl-admin-session='.length)+'x'],['expired',token('admin',Date.now()-1000)],['userA',token('audit-user-a',Date.now()+60000)],['userB',token('audit-user-b',Date.now()+60000)]]) {
        cookie='hl-admin-session='+value; const r=await api('/api/admin/vehicles',{car:synthetic()}); assert.equal(r.status,401); statuses.push({label,status:r.status});
      }
      cookie=old; return statuses;
    });
    await check('persisted create, replay, concurrent update and delete integrity', async () => {
      const car=synthetic(); const created=await api('/api/admin/vehicles',{car}); assert.equal(created.status,200); assert.equal(created.body.car.version,1);
      const duplicate=await api('/api/admin/vehicles',{car}); assert.equal(duplicate.status,409);
      const updates=await Promise.all([11111,22222].map(price=>api('/api/admin/vehicles',{car:{...car,price},previousVersion:1})));
      assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
      const stored=(await db.query('select data,version from vehicles where id=$1',[car.id])).rows[0]; assert.equal(stored.version,2); assert.ok([11111,22222].includes(stored.data.price));
      const staleDelete=await api('/api/admin/vehicles',{id:car.id,version:1},{method:'DELETE'}); assert.equal(staleDelete.status,409);
      const deletes=await Promise.all([1,2].map(()=>api('/api/admin/vehicles',{id:car.id,version:2},{method:'DELETE'}))); assert.deepEqual(deletes.map(r=>r.status).sort(),[200,409]);
      assert.equal((await db.query('select * from vehicles where id=$1',[car.id])).rows.length,0);
      await api('/api/admin/vehicles',{car:synthetic('AUDIT-UI')});
      return { create:created.status,duplicate:duplicate.status,updates:updates.map(r=>r.status),stored,staleDelete:staleDelete.status,deletes:deletes.map(r=>r.status),finalRowsForDeletedId:0 };
    });
    await check('contact optimistic concurrency checks real JSONB state', async () => {
      const previous=(await api('/api/site')).body.contacts;
      const responses=await Promise.all(['a','b'].map(x=>api('/api/admin/contacts',{contacts:{...previous,email:`audit-${x}@example.invalid`},previous})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
      return { statuses:responses.map(r=>r.status),stored:(await db.query('select contacts from site_settings')).rows };
    });
    await check('input boundaries and harmless injection probes', async () => {
      const probes=[['null-body',null],['empty',{}],['null-car',{car:null}],['negative',{car:{...synthetic('BAD-NEG'),price:-1}}],['zero',{car:{...synthetic('BAD-ZERO'),price:0}}],['string-price',{car:{...synthetic('BAD-STRING'),price:'1'}}],['fractional-year',{car:{...synthetic('BAD-YEAR'),year:2026.5}}],['future-year',{car:{...synthetic('BAD-FUTURE'),year:2036}}],['SQL-ID',{car:{...synthetic("audit' OR 1=1--")}}],['traversal-ID',{car:synthetic('../audit')}],['javascript-image',{car:{...synthetic('BAD-JS'),image:'javascript:alert(1)'}}],['data-image',{car:{...synthetic('BAD-DATA'),image:'data:text/html,AUDIT'}}],['too-many-photos',{car:{...synthetic('BAD-PHOTOS'),gallery:Array(101).fill(origin+'/motors-logo.png')}}],['long-text',{car:{...synthetic('BAD-LONG'),trim:'a'.repeat(128001)}}]];
      const out=[]; for(const [label,body] of probes) { const r=await api('/api/admin/vehicles',body); assert.ok(r.status>=400); out.push({label,status:r.status,error:r.body.error}); }
      const invalidJson=await api('/api/admin/vehicles','{',{raw:true}); assert.equal(invalidJson.status,400);
      const oversize=await api('/api/admin/vehicles',' '.repeat(256001),{raw:true}); assert.equal(oversize.status,413);
      const mime=await api('/api/admin/vehicles','{}',{raw:true,headers:{'content-type':'text/plain'}}); assert.equal(mime.status,400);
      return { cases:out,invalidJson:invalidJson.status,oversize:oversize.status,wrongMime:mime.status };
    });
    await check('enum arrays and unrestricted properties persist through API', async () => {
      const car={...synthetic('AUDIT-TYPE'),condition:['Новый'],owner_id:'synthetic-user-b',role:'admin',internal_note:'AUDIT_PRIVATE_MARKER'};
      const r=await api('/api/admin/vehicles',{car}); assert.equal(r.status,200);
      const stored=(await db.query('select data from vehicles where id=$1',[car.id])).rows[0].data;
      const publicCar=(await api('/api/site',undefined,{headers:{Cookie:''}})).body.cars.find(c=>c.id===car.id);
      assert.deepEqual(stored.condition,['Новый']); assert.equal(publicCar.internal_note,'AUDIT_PRIVATE_MARKER');
      const statusArray=await api('/api/admin/vehicles',{car:{...synthetic('AUDIT-STATUS'),status:['В наличии']}}); assert.equal(statusArray.status,503);
      await db.query('delete from vehicles where id=$1',[car.id]);
      return { finding:'F03',persistStatus:r.status,stored,publicExtraField:publicCar.internal_note,arrayStatus:statusArray.status,privilegeEscalation:false };
    });
    await check('small positive and extreme prices are stored verbatim', async () => {
      const out=[];
      for(const price of [0.0001,0.1+0.2,1e100]) { const car={...synthetic('AUDIT-PRICE-'+out.length),price};const r=await api('/api/admin/vehicles',{car});assert.equal(r.status,200);out.push({price,stored:(await db.query('select data from vehicles where id=$1',[car.id])).rows[0].data.price,display:load('lib/cars.ts').formatPrice(price)}); }
      return { observations:out,classification:'business rules for price upper bound/precision unspecified; sub-cent price displays as 0' };
    });
    await check('upload signing validates declaration but does not bind size/type', async () => {
      const out=[];
      for(const body of [{type:'text/html',size:1},{type:'image/png',size:0},{type:'image/png',size:15728641},{type:'video/mp4',size:52428801}]) { const r=await api('/api/admin/media',body);assert.equal(r.status,400);out.push({body,status:r.status}); }
      const r=await api('/api/admin/media',{type:'image/png',size:1,name:'../../audit.html'});assert.equal(r.status,200);
      assert.match(r.body.publicUrl,/vehicles\/[\w-]+\.png$/);
      return { declarationChecks:out,signingStatus:r.status,signRequest:state.signedRequests.at(-1),actualByteEnforcement:'UNVERIFIED: Storage service is not present; only signing transport is stubbed',bucket:(await db.query('select * from storage.buckets')).rows };
    });
    await check('desktop navigation, refresh, back and harmless stored XSS', async () => {
      const marker='<img src=x onerror="window.AUDIT_XSS=1">';
      await api('/api/admin/vehicles',{car:{...synthetic('AUDIT-XSS'),model:marker}});
      await page.goto(origin+'/catalog'); await page.getByText(marker,{exact:false}).first().waitFor();
      assert.equal(await page.evaluate(()=>window.AUDIT_XSS),undefined);
      await page.locator('a[href="/catalog/AUDIT-UI"]').first().click(); await page.waitForURL('**/catalog/AUDIT-UI');
      await page.reload(); await page.getByRole('heading',{name:'Audit Synthetic',exact:true}).waitFor();
      await page.goBack(); await page.waitForURL('**/catalog');
      await page.screenshot({path:path.join(evidence,'desktop-catalog.png'),fullPage:true});
      return { storedMarkerRenderedAsText:true,scriptExecuted:false,viewport:{width:1440,height:1000},refreshAndBack:true,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth) };
    });
    await check('public rendering crashes on accepted non-string condition', async () => {
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const saved=await api('/api/admin/vehicles',{car:{...synthetic('AUDIT-TYPE'),condition:['Новый']}});assert.equal(saved.status,200);
      assert.throws(()=>load('lib/i18n.ts').translate(['Новый'],'ru'),/replace/);
      await page.goto(origin+'/catalog/AUDIT-TYPE');
      await pause(1500);
      await page.screenshot({path:path.join(evidence,'invalid-condition-crash.png'),fullPage:true});
      const screen=(await page.locator('body').innerText()).slice(0,500);
      console.log('CONDITION_SCREEN',JSON.stringify({screen,errors}));
      await db.query('delete from vehicles where id=$1',['AUDIT-TYPE']);
      return { finding:'F03',saved:saved.body.car,errors,screen,unitRenderThrows:true,browserCrash:errors.some(e=>e.includes('replace')) };
    });
    await check('mobile catalogue, navigation, admin editor layout', async () => {
      await page.goto(origin+'/login'); await page.evaluate(()=>localStorage.setItem('hl-motors-language','ru'));
      // Remove the poison record after evidence; all of these are our synthetic rows.
      await db.query('delete from vehicles where id=$1',['AUDIT-TYPE']);
      await page.setViewportSize({width:390,height:844}); await page.goto(origin+'/catalog');
      // Ensure RU without assuming the language-storage key.
      const ru=page.getByRole('button',{name:'RU — Русский',exact:true});if(await ru.count()) await ru.first().click();
      await page.locator('a[href="/catalog/AUDIT-UI"]').first().waitFor();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      await page.screenshot({path:path.join(evidence,'mobile-catalog.png'),fullPage:true});
      await page.goto(origin+'/admin/vehicles'); await page.getByRole('button',{name:/Добавить автомобиль/}).click();
      await page.getByRole('dialog',{name:'Редактор автомобиля'}).waitFor();
      await page.screenshot({path:path.join(evidence,'mobile-editor.png'),fullPage:true});
      return { viewport:{width:390,height:844},catalogueOverflow:overflow,editorOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth) };
    });
    await check('mobile layout with normal prices and Chinese navigation', async () => {
      await db.query("delete from vehicles where id like 'AUDIT-PRICE-%' or id='AUDIT-XSS'");
      await page.goto(origin+'/catalog');await page.locator('a[href="/catalog/AUDIT-UI"]').first().waitFor();
      const normalOverflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      await page.getByRole('button',{name:'CN — 中文',exact:true}).first().click();await page.waitForFunction(()=>document.documentElement.lang==='zh-CN');
      await page.locator('a[href="/catalog/AUDIT-UI"]').first().click();await page.waitForURL('**/catalog/AUDIT-UI');await page.getByRole('heading',{name:'Audit Synthetic',exact:true}).waitFor();
      await page.screenshot({path:path.join(evidence,'mobile-normal-detail.png'),fullPage:true});
      await page.getByRole('button',{name:'RU — Русский',exact:true}).first().click();
      return {normalOverflow,ChineseDetailWorks:true};
    });
    await check('UI save, parallel tabs, network loss and session expiry', async () => {
      await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/admin/settings');
      await page.getByLabel('Email',{exact:true}).fill('ui-save@example.invalid');
      await page.getByRole('button',{name:'Сохранить контакты',exact:true}).click();await page.getByRole('status').filter({hasText:'Контакты сохранены'}).waitFor();
      assert.equal((await db.query('select contacts from site_settings')).rows[0].contacts.email,'ui-save@example.invalid');
      const second=await context.newPage();await second.goto(origin+'/admin/settings');await second.getByLabel('Email',{exact:true}).fill('stale-tab@example.invalid');
      await page.getByLabel('Email',{exact:true}).fill('winner-tab@example.invalid');await page.getByRole('button',{name:'Сохранить контакты',exact:true}).click();await page.getByRole('status').filter({hasText:'Контакты сохранены'}).waitFor();
      await second.getByRole('button',{name:'Сохранить контакты',exact:true}).click();await second.locator('p[role=alert]').waitFor();
      const staleMessage=await second.locator('p[role=alert]').innerText();assert.equal((await db.query('select contacts from site_settings')).rows[0].contacts.email,'winner-tab@example.invalid');
      await second.close();
      await page.getByLabel('Email',{exact:true}).fill('offline@example.invalid');await context.setOffline(true);await page.getByRole('button',{name:'Сохранить контакты',exact:true}).click();await page.locator('p[role=alert]').waitFor();
      const offlineMessage=await page.locator('p[role=alert]').innerText();const retained=await page.getByLabel('Email',{exact:true}).inputValue();await context.setOffline(false);
      assert.equal(retained,'offline@example.invalid');assert.equal((await db.query('select contacts from site_settings')).rows[0].contacts.email,'winner-tab@example.invalid');
      const liveCookies=await context.cookies();await context.clearCookies();
      await page.getByRole('button',{name:'Сохранить контакты',exact:true}).click();await page.locator('p[role=alert]').filter({hasText:'Сессия завершена'}).waitFor();
      const expiryMessage=await page.locator('p[role=alert]').innerText();await context.addCookies(liveCookies);
      return {persistedUiSave:true,staleMessage,offlineMessage,draftPreserved:true,expiryMessage,storedEmail:'winner-tab@example.invalid'};
    });
    await check('bounded login failures have no application throttling', async () => {
      assert.ok(loginRequest?.body);const headers={...loginRequest.headers};delete headers.cookie;delete headers['content-length'];headers.origin=origin;
      const body=loginRequest.body.toString().replace('123456!','audit-incorrect');assert.notEqual(body,loginRequest.body.toString());
      const start=Date.now(),statuses=[];for(let i=0;i<12&&Date.now()-start<10000;i++){const r=await fetch(origin+'/login',{method:'POST',headers,body,redirect:'manual',signal:AbortSignal.timeout(5000)});const t=await r.text();statuses.push({status:r.status,invalidCredentials:t.includes('Неверный логин')});if(r.status>=500)break;}
      assert.equal(statuses.length,12);assert.ok(statuses.every(x=>x.status===200&&x.invalidCredentials));
      return {finding:'F06',limit:{requests:12,concurrency:1,durationMs:10000},elapsedMs:Date.now()-start,statuses};
    });
    await check('outage and timeout fail closed and hide diagnostics', async () => {
      state.mode='error'; const before=(await db.query('select count(*) from vehicles')).rows;
      const publicRead=await api('/api/site');const write=await api('/api/admin/vehicles',{car:synthetic('AUDIT-OUTAGE')});
      assert.equal(publicRead.status,503);assert.equal(write.status,503);assert.doesNotMatch(JSON.stringify(publicRead),/AUDIT_DB_DIAGNOSTIC|synthetic-only/);
      state.mode='timeout';const callStart=state.calls.length;const start=Date.now();const timeout=await api('/api/site',undefined,{timeout:110000});const elapsed=Date.now()-start;assert.equal(timeout.status,503);
      state.mode='ok';const after=(await db.query('select count(*) from vehicles')).rows;assert.deepEqual(before,after);
      return { publicRead,write,timeout:{status:timeout.status,elapsedMs:elapsed,upstreamCalls:state.calls.length-callStart},rowsUnchanged:true };
    });
    state.mode='ok';
    await check('bounded load: max 24 requests, concurrency 1 then 4, deadline 15s', async () => {
      const start=Date.now(),times=[],statuses=[];let stop=false;
      for(const count of [1,3,4,4,4,4,4]) { if(Date.now()-start>15000||stop) break;await Promise.all(Array.from({length:count},async()=>{const t=Date.now();const r=await api('/api/site');times.push(Date.now()-t);statuses.push(r.status);if(r.status>=500)stop=true;})); }
      assert.ok(statuses.every(x=>x===200));times.sort((a,b)=>a-b);
      return { maxRequests:24,maxConcurrency:4,maxDurationMs:15000,stopOn:'first 5xx or deadline between batches',requests:statuses.length,durationMs:Date.now()-start,p50Ms:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],statuses };
    });
    await check('logout deletes browser cookie but replay still writes to database', async () => {
      await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/admin/vehicles');
      const before=cookie;
      await page.getByRole('button',{name:/Выйти/}).click();await page.waitForURL('**/login');
      assert.equal((await context.cookies()).some(c=>c.name==='hl-admin-session'),false);
      cookie='';const anonymous=await api('/api/admin/vehicles',{car:synthetic('AUDIT-LOGOUT')});assert.equal(anonymous.status,401);
      cookie=before;const replay=await api('/api/admin/vehicles',{car:synthetic('AUDIT-LOGOUT')});assert.equal(replay.status,200);
      const row=(await db.query('select id,version from vehicles where id=$1',['AUDIT-LOGOUT'])).rows;
      return { finding:'F02',cookieDeleted:true,withoutCookie:anonymous.status,replayedCookie:replay.status,stored:row,token:'REDACTED' };
    });
    await check('migration CHECK constraints admit missing protected fields', async () => {
      await db.query('insert into vehicles(id,data) values($1,$2)',['AUDIT-INVALID-SQL',{}]);
      const rows=(await db.query('select id,data,version from vehicles where id=$1',['AUDIT-INVALID-SQL'])).rows;
      await db.query('delete from vehicles where id=$1',['AUDIT-INVALID-SQL']);
      return { finding:'F05',stored:rows,precondition:'privileged/direct writer; public API rejects this record',reason:'PostgreSQL CHECK treats NULL as satisfied' };
    });
    await check('client bundles contain none of the synthetic server credentials', async () => {
      const files=[];function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.js'))files.push(f);}}walk(path.join(root,'.next/static'));
      const hits=[];for(const f of files){const text=fs.readFileSync(f,'utf8');for(const secret of [serviceKey,sessionSecret])if(text.includes(secret))hits.push(path.relative(root,f));}assert.equal(hits.length,0);return {checkedJavaScriptFiles:files.length,secretHits:hits};
    });
  } finally {
    if(browser) await browser.close();
    if(child) {child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),pause(3000)]);}
    server.closeAllConnections();await new Promise(r=>server.close(r));await db.close();fs.closeSync(log);
  }
  console.log('RESULT',results.filter(x=>x.completed).length,'completed;',results.filter(x=>!x.completed).length,'incomplete. Confirmed findings are observations, NOT security passes.');
  if(results.some(x=>!x.completed))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
