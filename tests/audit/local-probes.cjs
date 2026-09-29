const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {load,synthetic,sessionSecret}=require('./harness.cjs');
const observations=[];
const memory=new Map();global.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
const site=load('lib/site-data.ts');
const previous=site.readContacts();
site.writeContacts({...previous,email:'first-tab@example.invalid'});
site.writeContacts({...previous,telegram:'second_tab'});
const persisted=site.readContacts();assert.equal(persisted.email,previous.email);
observations.push({finding:'F08',name:'local contacts lose another tabs email change',initial:previous,firstTabEmail:'first-tab@example.invalid',secondTabEdit:'telegram only from stale snapshot',persisted,scope:'localStorage implementation; deterministic sequential stale edits, not a real two-tab timing race'});
const old={password:process.env.ADMIN_PASSWORD,secret:process.env.ADMIN_SESSION_SECRET};
process.env.ADMIN_PASSWORD='audit-password-one';process.env.ADMIN_SESSION_SECRET=sessionSecret;
let value='';const jar={get:()=>value?{value}:undefined};
const auth=load('lib/admin-auth.ts',{'next/headers':{cookies:async()=>jar}});
(async()=>{
try{
  value=auth.createSession();assert.equal(await auth.isAdmin(),true);
  process.env.ADMIN_PASSWORD='audit-password-two';assert.equal(auth.validCredentials('admin','audit-password-one'),false);assert.equal(await auth.isAdmin(),true);
  observations.push({finding:'F02',name:'password rotation leaves existing token valid',oldPasswordAccepted:false,oldSessionAccepted:true,scope:'actual auth module with only Next cookies context supplied; no token output'});
  const car=synthetic('LOCAL-ROUTE/TEST');site.writeCar(car);assert.ok(site.readCars().some(x=>x.id===car.id));
  observations.push({name:'local mode accepts slash in ID unlike cloud',storedId:car.id,scope:'local data API; public routing impact not browser-verified'});
  const normalize=load('lib/cloud-validation.ts').validateCloudCar;
  for(const model of ['汉字 🚘','A'.repeat(20000),"' OR 1=1 --"]){assert.equal(normalize({...synthetic(),model}).model,model);}
  observations.push({name:'Unicode, long text and SQL marker remain plain strings',cases:3});
  fs.writeFileSync(path.join(__dirname,'evidence','local-probes.json'),JSON.stringify(observations,null,2));console.log(JSON.stringify(observations,null,2));
}finally{for(const [key,v]of [['ADMIN_PASSWORD',old.password],['ADMIN_SESSION_SECRET',old.secret]]){if(v===undefined)delete process.env[key];else process.env[key]=v;}delete global.localStorage;}
})().catch(e=>{console.error(e);process.exitCode=1;});
