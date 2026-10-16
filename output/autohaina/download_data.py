from pathlib import Path
import urllib.request,re,json,sys,concurrent.futures
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).parent
base='https://www.autohaina.com'
urls={
 'brands':'/api/brands?lang=en',
 'gas_en':'/api/vehicles/0md6fj8ctt?lang=en',
 'flagship_en':'/api/vehicles/1gvt4f0acu?lang=en',
 'tesla_en':'/api/vehicles/vn62mvjh5s?lang=en',
 'tank_en':'/api/vehicles/qfcs22ib3c?lang=en',
 'prado_en':'/api/vehicles/q2pors2cmk?lang=en',
}
def run(kv):
 k,p=kv; f=root/(k+'.json')
 try:
  raw=urllib.request.urlopen(base+p,timeout=50).read().decode()
  data=json.loads(raw); f.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
  return k, (list(data) if isinstance(data,dict) else 'list '+str(len(data))),str(data)[:500]
 except Exception as e: return k,str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for r in pool.map(run,urls.items()):print(r)
