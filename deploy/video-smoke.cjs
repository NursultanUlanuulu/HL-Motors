// Run inside the production app container. Creates only synthetic video jobs;
// never creates/edits catalogue records. Credentials and signed URLs are not logged.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const { Pool } = require('pg');
const { S3Client, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { run, probe, videoInfo } = require('../scripts/video-worker.cjs');
const base = 'https://firstseven-auto.com';
let cookie = '', id;
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({ region:'auto', endpoint:process.env.R2_ENDPOINT, credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY} });
function hiddenForm(html) {
  const form = new FormData();
  for (const tag of html.matchAll(/<input\b[^>]*>/g)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#x27;/g,"'")]));
    if(attrs.type==='hidden'&&attrs.name) form.append(attrs.name,attrs.value||'');
  }
  return form;
}
async function api(body) {
  const response = await fetch(base+'/api/admin/video',{method:'POST',headers:{origin:base,cookie,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200); return response.json();
}
async function main() {
  const before = await (await fetch(base+'/api/site')).json();
  const unauth = await fetch(base+'/api/admin/video',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:'{"action":"recent"}'});
  assert.equal(unauth.status,401);
  const form = hiddenForm(await (await fetch(base+'/login')).text());
  form.set('username','admin');form.set('password',process.env.ADMIN_PASSWORD);
  const login = await fetch(base+'/login',{method:'POST',headers:{origin:base},body:form,redirect:'manual'});
  assert.equal(login.status,303);cookie=login.headers.getSetCookie().find(s=>s.startsWith('hl-admin-session='))?.split(';')[0];assert.ok(cookie);
  await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=360x640:rate=24','-t','2','-c:v','libx264','-threads','1','/tmp/video-upload-qa.mp4']);
  // Legal MP4 free box makes a >50 MiB upload without a long test video.
  const handle = await fs.open('/tmp/video-upload-qa.mp4','r+');
  const stat = await handle.stat(); const free = Buffer.alloc(8); free.writeUInt32BE(60*1024*1024,0);free.write('free',4);
  await handle.write(free,0,8,stat.size);await handle.truncate(stat.size+60*1024*1024);await handle.close();
  const bytes = (await fs.stat('/tmp/video-upload-qa.mp4')).size;
  const ticket = await api({action:'create',filename:'Synthetic video QA.mp4',type:'video/mp4',size:bytes});id=ticket.id;
  const cors = await fetch(ticket.uploadUrl,{method:'OPTIONS',headers:{Origin:base,'Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'content-type,cache-control'}});
  assert.equal(cors.headers.get('access-control-allow-origin'),base);
  const put = await fetch(ticket.uploadUrl,{method:'PUT',headers:{...ticket.headers,'content-length':String(bytes),Origin:base},body:createReadStream('/tmp/video-upload-qa.mp4'),duplex:'half',signal:AbortSignal.timeout(120000)});assert.ok(put.ok);
  await api({action:'start',id}); await api({action:'start',id});
  let result;
  for(let i=0;i<60;i++) {
    result=await api({action:'status',id});
    assert.notEqual(result.status,'failed',result.error);
    if(result.status==='ready') break;
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  assert.equal(result.status,'ready');assert.match(result.publicUrl,/\/vehicles\/video-[a-f0-9-]+\.mp4$/);
  const mp4=await fetch(result.publicUrl);assert.equal(mp4.status,200);assert.match(mp4.headers.get('content-type'),/video\/mp4/);
  const buffer=Buffer.from(await mp4.arrayBuffer());await fs.writeFile('/tmp/video-result-qa.mp4',buffer);
  const output=videoInfo(await probe('/tmp/video-result-qa.mp4'));assert.equal(output.video.width,360);assert.equal(output.video.height,640);assert.equal(output.video.codec_name,'h264');assert.ok(buffer.length<bytes);
  assert.ok(buffer.indexOf(Buffer.from('moov'))<buffer.indexOf(Buffer.from('mdat')));
  assert.ok((await api({action:'recent'})).jobs.some(job=>job.id===id&&job.status==='ready'));
  assert.equal((await api({action:'dismiss',id})).removed,true);
  assert.equal((await api({action:'dismiss',id})).removed,true);
  assert.ok(!(await api({action:'recent'})).jobs.some(job=>job.id===id));
  assert.equal((await api({action:'status',id})).publicUrl,result.publicUrl);
  const range = await fetch(result.publicUrl,{headers:{Range:'bytes=0-1023'}});assert.equal(range.status,206);await range.arrayBuffer();
  const after = await (await fetch(base+'/api/site')).json();assert.deepEqual(after.cars,before.cars);
  console.log('PASS real 60 MiB upload and processing; removed from recent jobs while MP4 and range playback stay available; catalogue unchanged.');
}
async function cleanup() {
  if(id) {
    const {rows}=await db.query('select input_key,output_key from video_jobs where id=$1',[id]);
    for(const row of rows) for(const Key of [row.input_key,row.output_key]) await s3.send(new DeleteObjectCommand({Bucket:process.env.R2_BUCKET,Key}));
    await db.query('delete from video_jobs where id=$1',[id]);
  }
  if(cookie) {
    const html=await(await fetch(base+'/admin/vehicles',{headers:{cookie}})).text();
    const form=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].find(m=>m[0].includes('$ACTION_ID_'));
    assert.ok(form);
    const logout=await fetch(base+'/admin/vehicles',{method:'POST',headers:{origin:base,cookie},body:hiddenForm(form[0]),redirect:'manual'});assert.equal(logout.status,303);
  }
  await fs.rm('/tmp/video-upload-qa.mp4',{force:true});await fs.rm('/tmp/video-result-qa.mp4',{force:true});
  await db.end();s3.destroy();
}
(async()=>{try{await main();}finally{await cleanup();}})().catch(error=>{console.error('Video smoke failed:',error.message);process.exitCode=1;});
