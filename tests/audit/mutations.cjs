// Mutate disposable copies only. Never edits application files in the checkout.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {root}=require('./harness.cjs');
const workspace=fs.mkdtempSync(path.join(__dirname,'.mutation-'));
const definitions=[
  {name:'accept-all-credentials',file:'lib/admin-auth.ts',from:"return equal(username, 'admin') && equal(password, process.env.ADMIN_PASSWORD || '123456!');",to:'return true;'},
  {name:'silently-corrupt-persisted-price',file:'lib/cloud-repository.ts',from:'insert({ id: car.id, data: car })',to:'insert({ id: car.id, data: { ...car, price: 1 } })'},
  {name:'remove-api-auth-check',file:'lib/api-server.ts',from:"if (!await isAdmin()) throw new DataError('Сессия завершена. Войдите в админку снова.', 401);",to:'/* audit mutation: removed auth check */'},
  {name:'remove-database-version-trigger',file:'supabase/migrations/202609140001_catalog.sql',from:'new.version := old.version + 1;',to:'new.version := old.version;'},
];
const hashes=()=>Object.fromEntries(definitions.map(d=>[d.file,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,d.file))).digest('hex')]));
const before=hashes(),results=[];
try {
  for(const definition of definitions){
    const target=path.join(workspace,definition.name);fs.mkdirSync(target);
    for(const dir of ['app','lib','supabase'])fs.cpSync(path.join(root,dir),path.join(target,dir),{recursive:true});
    fs.mkdirSync(path.join(target,'tests'));
    for(const file of ['cloud.test.cjs','site-data.test.cjs'])fs.copyFileSync(path.join(root,'tests',file),path.join(target,'tests',file));
    const filename=path.join(target,definition.file),source=fs.readFileSync(filename,'utf8');
    if(!source.includes(definition.from))throw new Error('Mutation target changed: '+definition.name);
    fs.writeFileSync(filename,source.replace(definition.from,definition.to));
    const run=spawnSync(process.execPath,['--test','tests/cloud.test.cjs','tests/site-data.test.cjs'],{cwd:target,encoding:'utf8',timeout:30000,windowsHide:true});
    fs.writeFileSync(path.join(__dirname,'evidence','mutation-'+definition.name+'.txt'),(run.stdout||'')+(run.stderr||''));
    results.push({name:definition.name,status:run.status,detected:run.status!==0,summary:run.stdout?.split('\n').filter(l=>/tests |pass |fail /.test(l))});
  }
  const after=hashes();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Original source changed unexpectedly');
  const report={originalSourceUnchanged:true,sourceHashes:before,results};
  fs.writeFileSync(path.join(__dirname,'evidence','mutations.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {
  const resolved=path.resolve(workspace),parent=path.resolve(__dirname)+path.sep;
  if(!resolved.startsWith(parent)||!path.basename(resolved).startsWith('.mutation-'))throw new Error('Unsafe cleanup path');
  fs.rmSync(resolved,{recursive:true,force:true});
}
