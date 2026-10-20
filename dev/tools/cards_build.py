import cv2, numpy as np, json, sys, math
S = sys.argv[1]; OUT = sys.argv[2]
M = json.load(open(S + '/cards_meta.json'))
icl = np.load(S + '/cards_lab.npy')
TYPES = ['dragao','psiquico','grama','pedra','agua','sombrio','lutador','fogo','veneno','eletrico','inseto','terra','metal','voador','fada','gelo','normal','veneno','fantasma','voador','pedra','grama','eletrico','fogo']
STR = {1:7,2:5,3:1,4:2,5:7,6:4,7:4,8:6,9:11,10:11,11:7,12:6,13:3}
slab = np.load(S + '/str_lab.npy'); s0 = np.load(S + '/str0.npy'); sub0 = {int(i): int(l) for i, l in zip(*s0)}
PAL = {'rosa':(236,111,171),'verde':(10,138,44),'azul':(11,116,200),'vermelho':(227,32,43),'amarelo':(247,200,20),'cinza':(70,70,70)}
cards = M['cards']
for c in cards: c['tipos'] = []; c['vantagens'] = []
byid = {c['id']: c for c in cards}
for (cid, kind, k), lab in zip(M['icons'], icl):
    t = TYPES[lab]; c = byid[cid]
    (c['tipos'] if kind == 'tipo' else c['vantagens']).append((k, t))
for i, c in enumerate(cards):
    c['tipos'] = [t for k, t in sorted(c['tipos'])]
    c['vantagens'] = [t for k, t in sorted(c['vantagens'])]
    l = int(slab[i]); c['forca'] = {0: 8, 1: 6, 2: 8}[sub0[i]] if l == 0 else STR[l]
    im = cv2.imread(S + '/x/' + c['img'])
    # dados: quadrados brancos na barra inferior
    bar = im[498:580, 5:310]; g = cv2.cvtColor(bar, cv2.COLOR_BGR2GRAY)
    wm = (g > 225).astype(np.uint8)
    n, lb, st, cen = cv2.connectedComponentsWithStats(wm)
    dice = []
    for j in range(1, n):
        x, y, w, h, a = st[j]
        if 45 < w < 80 and 45 < h < 80:
            sq = g[y+4:y+h-4, x+4:x+w-4]; pm = (sq < 90).astype(np.uint8)
            pn, _, pst, _ = cv2.connectedComponentsWithStats(pm)
            pips = sum(1 for q in range(1, pn) if 20 < pst[q][4] < 400)
            dice.append((x, pips))
    c['captura'] = [p for x, p in sorted(dice)]
    # bolinhas de família: pequenas Poké-Bolas à direita da barra
    reg = im[490:582, 305:360]
    gg = cv2.medianBlur(cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY), 3)
    cc = cv2.HoughCircles(gg, cv2.HOUGH_GRADIENT, dp=1, minDist=25, param1=100, param2=15, minRadius=11, maxRadius=20)
    fam = []
    if cc is not None:
        for x, y, r in sorted(cc[0], key=lambda v: v[1]):
            px = reg[int(y - r*0.55), int(x)][::-1].astype(int)
            best = min(PAL, key=lambda k: math.dist(px, PAL[k]))
            fam.append(best)
    c['familiaCores'] = fam
json.dump(cards, open(OUT, 'w'), ensure_ascii=False, indent=0)
for c in cards:
    if c['id'] in ('meowth','poliwhirl','raichu','machamp','groudon','bulbasaur','alolan graveler','gastly2','abra','alakazam','butterfree','growlithe','raticate'):
        print(c['id'], c['cor'], c['forca'], c['tipos'], c['vantagens'], c['captura'], c['familiaCores'])
