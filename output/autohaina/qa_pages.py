from pathlib import Path
from pdf2image import convert_from_path
from PIL import Image,ImageDraw
import sys
sys.stdout.reconfigure(encoding='utf-8')
r=Path(__file__).parent/'render'
pdf=r/'document.pdf'
r=r/'final_pages';r.mkdir(exist_ok=True)
pages=convert_from_path(str(pdf),dpi=110,output_folder=str(r),fmt='png',output_file='page',thread_count=3,paths_only=True)
for start in range(0,len(pages),4):
 images=[Image.open(p).convert('RGB') for p in pages[start:start+4]]
 w,h=images[0].size
 sheet=Image.new('RGB',(w*2,(h+30)*2),'#aab2bd'); draw=ImageDraw.Draw(sheet)
 for i,im in enumerate(images):
  x=(i%2)*w;y=(i//2)*(h+30);draw.text((x+12,y+8),'PAGE '+str(start+i+1),fill='black');sheet.paste(im,(x,y+30))
 sheet.save(r/f'sheet-{start//4+1:02}.png')
print('Rendered pages',len(pages))
