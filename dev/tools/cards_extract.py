import cv2, numpy as np, glob, os, json, sys, math
X = sys.argv[1]; OUT = sys.argv[2]
FOLD = {'0_-_starter':'inicial','1_-_pink':'rosa','2_-_green':'verde','3_-_blue':'azul','4_-_red':'vermelho','5_-_yellow':'amarelo'}
LEFT = [(149,238),(149,325)]; RIGHT = [(511,296),(511,386),(511,473),(511,559)]
cards = []; icons = []
def has_circle(g, cx, cy):
    win = g[cy-75:cy+75, cx-75:cx+75]
    c = cv2.HoughCircles(win, cv2.HOUGH_GRADIENT, dp=1, minDist=40, param1=100, param2=25, minRadius=44, maxRadius=60)
    if c is None: return False
    return any(abs(x-75) < 9 and abs(y-75) < 9 for x, y, r in c[0])
def feat(im, cx, cy):
    cr = im[cy-38:cy+38, cx-38:cx+38].copy()
    m = np.zeros(cr.shape[:2], np.uint8); cv2.circle(m, (38, 38), 36, 255, -1); cr[m == 0] = 0
    return cr
for d, cor in FOLD.items():
    for f in sorted(glob.glob(os.path.join(X, d, '*.png'))):
        n = os.path.basename(f)[:-4]
        if 'back' in n: continue
        im = cv2.imread(f); im = cv2.copyMakeBorder(im, 80, 80, 80, 80, cv2.BORDER_CONSTANT, value=(255,255,255)); g = cv2.medianBlur(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY), 5)
        c = dict(id=n, cor=cor, img=d+'/'+os.path.basename(f), tipos=[], vantagens=[])
        for k, (x, y) in enumerate(LEFT):
            if has_circle(g, x, y): icons.append((n, 'tipo', k, feat(im, x, y)))
        for k, (x, y) in enumerate(RIGHT):
            if has_circle(g, x, y): icons.append((n, 'vant', k, feat(im, x, y)))
        cards.append(c)
np.save(OUT + '_icons.npy', np.stack([i[3] for i in icons]))
json.dump({'cards': cards, 'icons': [(a, b, k) for a, b, k, _ in icons]}, open(OUT + '_meta.json', 'w'))
print(len(cards), 'cartas', len(icons), 'ícones')
