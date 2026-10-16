from pathlib import Path
import json,sys
sys.stdout.reconfigure(encoding='utf-8')
r=Path(__file__).parent
groups={}
top={};specs={}
for p in r.glob('*_en.json'):
 if p.stem=='filters_en':continue
 d=json.loads(p.read_text(encoding='utf-8'))
 for k,v in d['data'].items():top.setdefault(k,[]).append(v)
 for k,v in d['data'].get('specs',{}).items():specs.setdefault(k,[]).append(v)
 for g,rows in d.get('parameters_by_group',{}).items():
  dest=groups.setdefault(g,{})
  for row in rows:dest.setdefault(row['param_name'],[]).append({'value':row['param_value'],'source':p.stem})
(r/'union.json').write_text(json.dumps({'groups':groups,'top':top,'specs':specs},ensure_ascii=False,indent=2),encoding='utf-8')
print('GROUPS',len(groups),'ROWS',sum(len(x) for x in groups.values()),'UNIQUE',len(set(k for g in groups.values() for k in g)))
for g,rows in groups.items():print('\n'+g+':\n'+'\n'.join(rows))
print('TOP',list(top));print('SPECS',list(specs))
b=json.loads((r/'brands.json').read_text(encoding='utf-8'))['data'];print('BRANDS',len(b), 'VALID ID',sum(bool(x['make_id']) for x in b));print('BRAND EXAMPLES', b[20:24])
