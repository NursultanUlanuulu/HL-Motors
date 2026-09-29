// Read-only inventory; never prints secret values or the real database hostname.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {root}=require('./harness.cjs');
const env={};const envPath=path.join(root,'.env.local');
if(fs.existsSync(envPath))for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const files=cp.execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8',windowsHide:true}).trim().split('\n');
const staticFiles=[];function walk(p){for(const item of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,item.name);if(item.isDirectory())walk(f);else if(item.name.endsWith('.js'))staticFiles.push(f);}}
walk(path.join(root,'.next/static'));
const hits=[];
for(const f of [...files.map(f=>path.join(root,f)),...staticFiles]){const buffer=fs.readFileSync(f);for(const key of ['SUPABASE_SECRET_KEY','ADMIN_SESSION_SECRET'])if(env[key]&&buffer.includes(Buffer.from(env[key])))hits.push({file:path.relative(root,f),key});}
const dependencies=Object.fromEntries(['next','react','react-dom','@supabase/supabase-js','typescript'].map(name=>[name,require(name+'/package.json').version]));
const out={date:new Date().toISOString(),commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),node:process.version,dependencies,builtinRscPeer:require('next/dist/compiled/react-server-dom-webpack/package.json').peerDependencies.react,envPresence:Object.fromEntries(Object.entries(env).map(([key,value])=>[key,value?'set (redacted)':'empty'])),trackedFiles:files.length,clientJsFiles:staticFiles.length,fullSecretValueHits:hits,limitation:'exact current-secret match only; git history, arbitrary secrets and runtime logs from production not scanned'};
fs.writeFileSync(path.join(__dirname,'evidence','inspection.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
