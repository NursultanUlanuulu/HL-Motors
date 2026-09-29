// Builds only with explicit synthetic integration configuration.
const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const {root,dbOrigin,serviceKey,sessionSecret}=require('./harness.cjs');
const result=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build'],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,SUPABASE_URL:dbOrigin,SUPABASE_SECRET_KEY:serviceKey,ADMIN_SESSION_SECRET:sessionSecret,ADMIN_PASSWORD:'',NEXT_TELEMETRY_DISABLED:'1'}});
const output=(result.stdout||'')+(result.stderr||'');fs.mkdirSync(path.join(__dirname,'evidence'),{recursive:true});fs.writeFileSync(path.join(__dirname,'evidence','audit-build.txt'),output);console.log(output);process.exitCode=result.status??1;
