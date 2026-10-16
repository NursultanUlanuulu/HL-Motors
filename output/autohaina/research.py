from pathlib import Path
import urllib.request, re, json
root=Path(__file__).parent
url='https://www.autohaina.com/vehicles/mercedes-benz-glc-2023-0md6fj8ctt'
s=urllib.request.urlopen(url,timeout=30).read().decode()
(root/'car.html').write_text(s,encoding='utf-8')
print('HTML',len(s))
for term in ['Engine model','264 920','specifications','__NEXT_DATA__','vehicle-detail-content']:
 p=s.find(term); print(term,p,s[max(0,p-200):p+250])
print('SCRIPTS',re.findall(r'<script[^>]*src="([^"]+)',s))
u='https://www.autohaina.com/_next/static/chunks/app/vehicles/%5Bid%5D/page-5d22b99c6c2abec5.js'
j=urllib.request.urlopen(u,timeout=30).read().decode(); (root/'detail.js').write_text(j,encoding='utf-8')
for m in list(re.finditer('/api/',j))[:30]: print(j[max(0,m.start()-100):m.start()+180])
u='https://www.autohaina.com/_next/static/chunks/9299-60650fcc15dee3d1.js'
j=urllib.request.urlopen(u,timeout=30).read().decode(); (root/'card_chunk.js').write_text(j,encoding='utf-8')
for pattern in ['/api/', 'fetch(', 'specs', 'technical']:
 print('PATTERN',pattern)
 for m in list(re.finditer(re.escape(pattern),j))[:12]: print(j[max(0,m.start()-150):m.start()+250])
print('HTML tail',s[-12000:-6000])
