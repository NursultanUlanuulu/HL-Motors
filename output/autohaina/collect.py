from pathlib import Path
import urllib.request,re,json,sys,concurrent.futures
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).parent
base='https://www.autohaina.com'
def get(u): return urllib.request.urlopen(u,timeout=40).read().decode()
h=(root/'car.html').read_text(encoding='utf-8')
paths=re.findall(r'<script[^>]*src="([^"]+)',h)
paths=[p for p in paths if any(k in p for k in ['5154-','8720-','3480-','821-','2619-','4580-'])]
def chunk(p):
 name=p.rsplit('/',1)[1]; f=root/name
 s=f.read_text(encoding='utf-8') if f.exists() else get(base+p)
 f.write_text(s,encoding='utf-8')
 hits=[]
 for m in re.finditer(r'/api/(?:vehicles|brands|car)[^"` ]*',s): hits.append(s[max(0,m.start()-120):m.start()+250])
 return name,hits
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for name,hits in pool.map(chunk,paths):
  if hits: print(name, '\n'.join(hits))
