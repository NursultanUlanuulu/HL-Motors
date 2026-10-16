from pathlib import Path
import json,sys
sys.stdout.reconfigure(encoding='utf-8')
r=Path(__file__).parent
t=dict(x.split('|',1) for x in (r/'translations.txt').read_text(encoding='utf-8').splitlines() if '|' in x)
u=json.loads((r/'union.json').read_text(encoding='utf-8'))
names=set(k for g in u['groups'].values() for k in g)
print('Missing',sorted(names-set(t)))
for p in sorted(r.glob('*_en.json')):
 if p.stem=='filters_en': continue
 d=json.loads(p.read_text(encoding='utf-8')); print(p.stem,d['data']['specs'])
