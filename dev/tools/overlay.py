import json,sys,os
from PIL import Image, ImageDraw
HEXDIR, MAP, OUTDIR = sys.argv[1], sys.argv[2], sys.argv[3]
names = sys.argv[4:]
m=json.load(open(MAP))['hexes']
col={'rosa':(236,111,171),'verde':(10,200,44),'azul':(60,160,255),'vermelho':(255,40,50),'amarelo':(247,200,20),'cinza':(200,200,200)}
for n in names:
  h=m[n]; im=Image.open(os.path.join(HEXDIR,n+'.png')).convert('RGBA'); W,H=im.size
  bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im); im=Image.blend(bg,Image.new('RGBA',im.size,(0,0,0,255)),0.45)
  d=ImageDraw.Draw(im); P={s['id']:(s['x']*W,s['y']*H) for s in h['spaces']}
  for e in h['edges']: d.line([P[e['a']],P[e['b']]],fill=(255,120,0) if e.get('duvida') else (255,230,0),width=7)
  for c in h['slots']:
    x,y=c['x']*W,c['y']*H; d.rectangle([x-30,y-38,x+30,y+38],outline=col[c['color']],width=6)
    if c['space']: d.line([(x,y),P[c['space']]],fill='white',width=2)
  for s in h['spaces']:
    x,y=P[s['id']]; r=14 if s['kind']=='porta' else 30
    d.ellipse([x-r,y-r,x+r,y+r],outline=col.get(s['color'],(255,255,255)),width=7)
    d.text((x-8,y-6),{'pokebola':'P','evento':'!','superevento':'S','cidade':'C','porta':'>','especial':'X','passagem':'T'}.get(s['kind'],'?'),fill='white')
    d.rectangle([x+r-2,y-r-14,x+r+34,y-r+2],fill='black'); d.text((x+r,y-r-12),s['id'],fill='yellow')
  im.convert('RGB').resize((W*55//100,H*55//100)).save(os.path.join(OUTDIR,'ov_'+n+'.jpg'),quality=82)
