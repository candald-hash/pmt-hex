"""Rascunho automático do mapeamento dos hexágonos (espaços, cartas, ligações, saídas)."""
import cv2, numpy as np, json, glob, os, sys, math

HEXDIR, TRUTH, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
PAL = {'rosa':(236,111,171),'verde':(10,138,44),'azul':(11,116,200),'vermelho':(227,32,43),'amarelo':(247,200,20)}

def load(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 3: im = np.dstack([im, np.full(im.shape[:2], 255, np.uint8)])
    rgb = im[:, :, :3][:, :, ::-1].astype(np.int16); a = im[:, :, 3]
    return rgb, a

def white(rgb, a): return ((rgb.min(2) > 205) & (a > 200)).astype(np.uint8) * 255
def dark(rgb, a):  return ((rgb.max(2) < 60) & (a > 200))

def color_masks(rgb, a, tol=70):
    out = {}
    for k, c in PAL.items():
        d = np.sqrt(((rgb - np.array(c)) ** 2).sum(2))
        out[k] = ((d < tol) & (a > 200)).astype(np.uint8) * 255
    return out

# ---------- templates a partir do A1 (mapeado pelo Douglas) ----------
truth = json.load(open(TRUTH))['hexes']['A1BR']
rgbA, aA = load(os.path.join(HEXDIR, 'A1BR.png')); W0 = aA.shape[1]; H0 = aA.shape[0]
wA = white(rgbA, aA)
TR = int(W0 * 0.042)
def crop(m, s): x, y = int(s['x'] * W0), int(s['y'] * H0); return m[y-TR:y+TR, x-TR:x+TR]
def best_center(m, s, tmpl):
    """refina o centro do espaço de referência"""
    x, y = int(s['x'] * W0), int(s['y'] * H0); r = TR + 15
    win = m[y-r-TR:y+r+TR, x-r-TR:x+r+TR]
    res = cv2.matchTemplate(win, tmpl, cv2.TM_CCOEFF_NORMED); _, _, _, mx = cv2.minMaxLoc(res)
    return mx
balls = [s for s in truth['spaces'] if s['kind'] == 'pokebola']
evts = [s for s in truth['spaces'] if s['kind'] == 'evento']
T_BALL = np.mean([crop(wA, s).astype(np.float32) for s in balls], 0).astype(np.uint8)
T_EVT = np.mean([crop(wA, s).astype(np.float32) for s in evts], 0).astype(np.uint8)
cv2.imwrite(OUT + '_tball.png', T_BALL); cv2.imwrite(OUT + '_tevt.png', T_EVT)

def find(m, tmpl, thr, mind):
    res = cv2.matchTemplate(m, tmpl, cv2.TM_CCOEFF_NORMED)
    pts = []
    r = res.copy()
    while True:
        _, mv, _, ml = cv2.minMaxLoc(r)
        if mv < thr: break
        pts.append((ml[0] + TR, ml[1] + TR, float(mv)))
        cv2.circle(r, ml, int(mind), -1, -1)
    return pts

def ring_color(rgb, a, x, y, W):
    votes = {}
    H, Wd = a.shape
    for rr in (0.047, 0.052, 0.057):
        for k in range(36):
            t = k / 36 * 2 * math.pi; px, py = int(x + math.cos(t) * rr * W), int(y + math.sin(t) * rr * W)
            if not (0 <= px < Wd and 0 <= py < H) or a[py, px] < 200: continue
            c = rgb[py, px]
            best, bd = None, 1e9
            for n, p in PAL.items():
                d = math.dist(c, p)
                if d < bd: bd, best = d, n
            if bd < 80: votes[best] = votes.get(best, 0) + 1
    return max(votes, key=votes.get) if votes else 'cinza'

def small_color(rgb, a, x, y, r):
    votes = {}
    for k in range(24):
        t = k/24*2*math.pi; px, py = int(x+math.cos(t)*r*0.8), int(y+math.sin(t)*r*0.8)
        c = rgb[py, px]; best, bd = None, 1e9
        for n, p in PAL.items():
            d = math.dist(c, p)
            if d < bd: bd, best = d, n
        if bd < 110: votes[best] = votes.get(best, 0) + 1
    return max(votes, key=votes.get) if votes else 'cinza'

def ring_votes(rgb, a, x, y, W):
    v = 0; H, Wd = a.shape
    for rr in (0.047, 0.052, 0.057):
        for k in range(36):
            t = k / 36 * 2 * math.pi; px, py = int(x + math.cos(t) * rr * W), int(y + math.sin(t) * rr * W)
            if not (0 <= px < Wd and 0 <= py < H): continue
            c = rgb[py, px]
            if min(math.dist(c, p) for p in PAL.values()) < 80: v += 1
    return v

def tier_of(name):
    return {'A': 'inicio', 'B': 't1', 'C': 't2', 'D': 't3', 'E': 'fim'}.get(name[0].upper(), '')

# saídas padrão por tier (parâmetro t ao longo de cada lado, vértices do topo em sentido horário)
SIDES = ['NE', 'L', 'SE', 'SO', 'O', 'NO']
def verts(W, H): return [(W/2, 0), (W, H*.25), (W, H*.75), (W/2, H), (0, H*.75), (0, H*.25)]

def detect_exits(a, rgb, W, H):
    V = verts(W, H); cx, cy = W/2, H/2; k = 0.955; dk = dark(rgb, a); out = {}
    for i in range(6):
        p, q = V[i], V[(i+1) % 6]
        p = (cx+(p[0]-cx)*k, cy+(p[1]-cy)*k); q = (cx+(q[0]-cx)*k, cy+(q[1]-cy)*k)
        N = 500; runs = []; cur = None
        for j in range(N):
            t = j/(N-1); x = int(min(W-1, p[0]+(q[0]-p[0])*t)); y = int(min(H-1, p[1]+(q[1]-p[1])*t))
            d = dk[y, x]
            if d and cur is None: cur = j
            if (not d or j == N-1) and cur is not None:
                if j - cur >= 8: runs.append(((cur+j)/2/(N-1), j-cur))
                cur = None
        out[SIDES[i]] = runs
    return out

def seg_dark(dk, a, p, q, r0, r1):
    """fração de pixels escuros no segmento p->q, ignorando r0 perto de p e r1 perto de q"""
    L = math.dist(p, q)
    if L <= r0 + r1 + 4: return 1.0
    n = int(L - r0 - r1); hits = 0; tot = 0
    H, W = dk.shape
    for i in range(n):
        t = (r0 + i) / L; x = int(p[0] + (q[0]-p[0])*t); y = int(p[1] + (q[1]-p[1])*t)
        if not (0 <= x < W and 0 <= y < H): continue
        # tolera pequenas curvas: pixel escuro num raio de 4
        tot += 1
        if dk[max(0,y-4):y+5, max(0,x-4):x+5].any(): hits += 1
    return hits / max(1, tot)

def automap(path):
    name = os.path.basename(path)[:-4]
    rgb, a = load(path); H, W = a.shape
    wm = white(rgb, a); dk = dark(rgb, a)
    R = 0.058 * W
    nodes = []
    cand = [dict(x=x, y=y, kind='pokebola', sc=sc) for (x, y, sc) in find(wm, T_BALL, 0.55, R * 1.2)]
    cand += [dict(x=x, y=y, kind='evento', sc=sc) for (x, y, sc) in find(wm, T_EVT, 0.55, R * 1.2)]
    cand.sort(key=lambda n: -n['sc'])
    for n in cand:
        if all(math.dist((n['x'], n['y']), (m['x'], m['y'])) > R * 1.2 for m in nodes): nodes.append(n)
    def interior(n):
        # fração de vermelho na metade de cima do miolo (Poké-Bola) e fração da cor do anel no miolo (Evento)
        red = tot = 0
        for dx in range(-int(.03*W), int(.03*W)+1, 4):
            for dy in range(-int(.032*W), -int(.012*W), 4):
                c = rgb[int(n['y']+dy), int(n['x']+dx)]; tot += 1
                if c[0] > 170 and c[1] < 90 and c[2] < 100: red += 1
        return red / max(1, tot)
    keep = []
    for n in nodes:
        n['color'] = ring_color(rgb, a, n['x'], n['y'], W)
        n['votes'] = ring_votes(rgb, a, n['x'], n['y'], W)
        rt = interior(n)
        if n['kind'] == 'pokebola' and rt < 0.35:
            continue
        if n['kind'] == 'evento' and n['votes'] < 25: continue
        if n['kind'] == 'pokebola' and n['votes'] < 25: continue
        keep.append(n)
    nodes = keep
    for n in nodes:
        if n['kind'] == 'evento' and n['color'] == 'amarelo': n['kind'] = 'superevento'
    _wo = cv2.morphologyEx(wm, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    _n, _l, _st, _c = cv2.connectedComponentsWithStats(_wo)
    CITYBOXES = [tuple(_st[i][:4]) for i in range(1, _n) if _st[i][2] > 0.18*W and _st[i][3] > 0.07*H and _st[i][4] > 0.45*_st[i][2]*_st[i][3] and _st[i][2] < 0.45*W]
    # passagens de tipo: círculos pequenos (raio ~0.022W) fora dos espaços normais
    g = cv2.medianBlur(cv2.cvtColor(np.ascontiguousarray(rgb[:, :, ::-1].astype(np.uint8)), cv2.COLOR_BGR2GRAY), 5)
    hc = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1, minDist=30, param1=120, param2=28, minRadius=int(0.019*W), maxRadius=int(0.03*W))
    if hc is not None:
        for (x, y, r) in hc[0]:
            if r < 0.02*W: continue
            if any(math.dist((x, y), (n['x'], n['y'])) < R*1.3 for n in nodes): continue
            # precisa tocar o caminho preto em pelo menos 2 direções
            dirs = set()
            for k in range(24):
                t = k/24*2*math.pi
                for rr in (r+8, r+14):
                    px, py = int(x+math.cos(t)*rr), int(y+math.sin(t)*rr)
                    if 0 <= px < W and 0 <= py < H and dk[py, px]: dirs.add(k*4//24)
            if len(dirs) < 2: continue
            if any(bx-45 < x < bx+bw+45 and by-45 < y < by+bh+45 for (bx, by, bw, bh) in CITYBOXES): continue
            nodes.append(dict(x=float(x), y=float(y), kind='passagem', color=small_color(rgb, a, x, y, r), r=float(r)))
    # cidades: grandes caixas brancas
    num, lab, st, cen = cv2.connectedComponentsWithStats(cv2.morphologyEx(wm, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8)))
    cities = []
    for i in range(1, num):
        x, y, w, h, ar = st[i]
        if w > 0.18*W and h > 0.07*H and ar > 0.45*w*h and w < 0.45*W: cities.append((x, y, w, h))
    nodes = [n for n in nodes if not any(bx-10 < n['x'] < bx+bw+10 and by-10 < n['y'] < by+bh+10 for (bx, by, bw, bh) in cities)]
    for (x, y, w, h) in cities:
        nodes.append(dict(x=x+w/2, y=y+h/2, kind='cidade', color='cinza', box=(x, y, w, h)))
    # cartas: retângulos sólidos de cor
    slots = []
    ksz = int(0.085 * W)
    for c, m in color_masks(rgb, a).items():
        mo = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((ksz, ksz), np.uint8))
        num, lab, st, cen = cv2.connectedComponentsWithStats(mo)
        for i in range(1, num):
            x, y, w, h, ar = st[i]
            if w > 0.09*W and h > 0.08*H:
                slots.append(dict(x=x+w/2, y=y+h/2, color=c, w=w, h=h))
    # saídas padrão: centro do traço escuro mais próximo da posição padrão do tier
    ex = detect_exits(a, rgb, W, H)
    V = verts(W, H); cx, cy = W/2, H/2
    ports = []
    for i, sd in enumerate(SIDES):
        std = STD.get(tier_of(name), {}).get(sd)
        cands = ex[sd]
        if std is None or not cands: continue
        t, _ = min(cands, key=lambda c: abs(c[0]-std))
        if abs(t - std) > 0.06: continue
        p, q = V[i], V[(i+1) % 6]; k = 0.975
        p = (cx+(p[0]-cx)*k, cy+(p[1]-cy)*k); q = (cx+(q[0]-cx)*k, cy+(q[1]-cy)*k)
        ports.append(dict(x=p[0]+(q[0]-p[0])*t, y=p[1]+(q[1]-p[1])*t, kind='porta', color='cinza', side=sd, t=round(t, 3)))
    nodes += ports
    # ligações: segmento reto escuro entre dois nós, sem outro nó no meio
    def rad(n):
        if n['kind'] == 'porta': return 4
        if n['kind'] == 'passagem': return n['r'] + 3
        if n['kind'] == 'cidade': return None
        return R * 1.02
    def edge_pt(n, toward):
        """ponto de saída do nó em direção a outro (cidade = borda da caixa)"""
        if n['kind'] != 'cidade': return (n['x'], n['y'])
        return (n['x'], n['y'])
    edges = []
    for i in range(len(nodes)):
        for j in range(i+1, len(nodes)):
            A, B = nodes[i], nodes[j]
            p, q = (A['x'], A['y']), (B['x'], B['y'])
            # cidade: o caminho sai do ponto da caixa mais próximo do outro nó
            def clampbox(n, o):
                x, y, w, h = n['box']; return (min(max(o[0], x), x+w), min(max(o[1], y), y+h))
            if A['kind'] == 'cidade' and B['kind'] == 'cidade': continue
            if B['kind'] == 'cidade': A, B, p, q = B, A, q, p
            if A['kind'] == 'cidade':
                bx, by, bw, bh = A['box']
                border = [(bx+bw*u/20, by) for u in range(21)] + [(bx+bw*u/20, by+bh) for u in range(21)] + [(bx, by+bh*u/12) for u in range(13)] + [(bx+bw, by+bh*u/12) for u in range(13)]
                border.sort(key=lambda b: math.dist(b, q))
                best = None
                for bp in border[:20]:
                    if math.dist(bp, q) > 0.3*W: continue
                    f = seg_dark(dk, a, bp, q, 6, rad(B))
                    if f >= 0.8 and (best is None or f > best[0] or (f == best[0] and math.dist(bp, q) < math.dist(best[1], q))): best = (f, bp)
                if best: edges.append((nodes.index(A), nodes.index(B), best[0]))
                continue
            L = math.dist(p, q)
            if L > 0.42 * W: continue
            if A['kind'] == 'porta' and B['kind'] == 'porta': continue
            def r_of(n, other):
                return 6 if n['kind'] == 'cidade' else rad(n)
            r0 = r_of(A, q); r1 = r_of(B, p)
            if r0 + r1 >= L: continue
            # outro nó no caminho?
            blocked = False
            for k2, C in enumerate(nodes):
                if k2 in (i, j) or C['kind'] == 'porta': continue
                cpt = (C['x'], C['y'])
                t = ((cpt[0]-p[0])*(q[0]-p[0]) + (cpt[1]-p[1])*(q[1]-p[1])) / (L*L)
                if 0 < t < 1:
                    d = abs((q[0]-p[0])*(p[1]-cpt[1]) - (p[0]-cpt[0])*(q[1]-p[1])) / L
                    lim = (C['box'][2]/2 if C['kind'] == 'cidade' else R*0.9)
                    if C['kind'] == 'cidade':
                        x, y, w, h = C['box']
                        # testa se o segmento cruza a caixa (amostragem)
                        for s in range(1, 20):
                            tt = s/20; px, py = p[0]+(q[0]-p[0])*tt, p[1]+(q[1]-p[1])*tt
                            if x < px < x+w and y < py < y+h: blocked = True; break
                    elif d < lim: blocked = True
                if blocked: break
            if blocked: continue
            f = seg_dark(dk, a, p, q, r0, r1)
            if f >= 0.92 or (f >= 0.8 and L < 0.25*W): edges.append((i, j, round(f, 3)))
    keep = []
    byport = {}
    for e in edges:
        i, j, f = e
        pi = i if nodes[i]['kind'] == 'porta' else (j if nodes[j]['kind'] == 'porta' else None)
        if pi is None: keep.append(e); continue
        o = j if pi == i else i
        d = math.dist((nodes[o]['x'], nodes[o]['y']), (nodes[pi]['x'], nodes[pi]['y']))
        if pi not in byport or (f, -d) > byport[pi][0]: byport[pi] = ((f, -d), e)
    edges = keep + [v[1] for v in byport.values()]
    edges = list({(min(i, j), max(i, j)): (min(i, j), max(i, j), f) for i, j, f in edges}.values())
    # monta saída no formato do mapeador
    hx = dict(id=name, tier=tier_of(name), w=W, h=H, spaces=[], slots=[], edges=[], seq=0, done=False, nota='rascunho automático — revisar', auto=True)
    def nid(p): hx['seq'] += 1; return p + str(hx['seq'])
    ids = []
    for n in nodes:
        s = dict(id=nid('s'), x=round(n['x']/W, 4), y=round(n['y']/H, 4), kind=n['kind'], color=n['color'])
        if n['kind'] == 'cidade': s['cidade'] = dict(nome='', insignias='', tipoLider='', lider='', pioneiro='', primeiraVisita='')
        if n['kind'] == 'porta': s['lado'] = n['side']; s['t'] = n['t']
        hx['spaces'].append(s); ids.append(s['id'])
    for (i, j, f) in edges:
        e = dict(id=nid('e'), a=ids[i], b=ids[j], dir='both', itemCost=0)
        if f < 0.92: e['duvida'] = True
        hx['edges'].append(e)
    used = set()
    for c in slots:
        best, bd = None, 1e9
        for k, n in enumerate(nodes):
            if n['kind'] != 'pokebola' or k in used: continue
            d = math.dist((c['x'], c['y']), (n['x'], n['y']))
            if d < bd: bd, best = d, k
        sp = None
        if best is not None and bd < 0.2*W: used.add(best); sp = ids[best]
        hx['slots'].append(dict(id=nid('c'), x=round(c['x']/W, 4), y=round(c['y']/H, 4), color=c['color'], space=sp))
    return hx, ex

# posições padrão das saídas, por tier (medidas nas imagens)
STD = {}
if __name__ == '__main__':
    files = sorted(glob.glob(os.path.join(HEXDIR, '*.png')))
    # 1ª passada: posições padrão = mediana por tier/lado do traço escuro mais "votado"
    allex = {}
    for f in files:
        rgb, a = load(f); H, W = a.shape; allex[os.path.basename(f)[:-4]] = detect_exits(a, rgb, W, H)
    for tier in ['t1', 't2', 't3']:
        STD[tier] = {}
        names = [n for n in allex if tier_of(n) == tier]
        for sd in SIDES:
            ts = [round(t, 2) for n in names for (t, w) in allex[n][sd]]
            # valor mais frequente (±0.03)
            best = max(ts, key=lambda v: sum(abs(v-u) < 0.03 for u in ts))
            sup = sum(abs(best-u) < 0.03 for u in ts)
            STD[tier][sd] = float(np.median([u for u in ts if abs(best-u) < 0.03]))
            print(tier, sd, round(STD[tier][sd], 3), f'{sup}/{len(names)}')
    # início e fim: só os lados com saída real (vizinhos no tabuleiro)
    STD['inicio'] = {'NE': None, 'L': None}
    STD['fim'] = {'O': None, 'SO': None}
    for n, sides in (('A1BR', ['NE', 'L']), ('E2BR', ['O', 'SO'])):
        for sd in sides:
            STD[tier_of(n)][sd] = max(allex[n][sd], key=lambda c: c[1])[0] if allex[n][sd] else None
    # para A1, a NE real é a de t≈0.47 (a outra é ruído)
    STD['inicio']['NE'] = min(allex['A1BR']['NE'], key=lambda c: abs(c[0]-(1-STD['t1']['SO'])))[0]
    print('inicio', STD['inicio'], 'fim', STD['fim'])
    result = {'version': 1, 'hexes': {}, 'saidasPadrao': STD}
    for f in files:
        hx, ex = automap(f); result['hexes'][hx['id']] = hx
        k = {}
        for s in hx['spaces']: k[s['kind']] = k.get(s['kind'], 0) + 1
        print(hx['id'].ljust(13), k, 'cartas', len(hx['slots']), 'lig', len(hx['edges']), 'sem-carta', sum(1 for c in hx['slots'] if not c['space']))
    json.dump(result, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
