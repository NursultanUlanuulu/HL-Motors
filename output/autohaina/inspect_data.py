from pathlib import Path
import re,json,sys
sys.stdout.reconfigure(encoding='utf-8')
r=Path(__file__).parent
s=(r/'card_chunk.js').read_text(encoding='utf-8')
for term in ['getVehicle','/api/vehicles','detailGroups','specification','specs:']:
 print('\nTERM',term)
 for m in list(re.finditer(re.escape(term),s))[:8]: print(s[max(0,m.start()-200):m.start()+350])
h=(r/'car.html').read_text(encoding='utf-8')
print('TAIL',h[-6000:])
