import json, sys
AUTO, TRUTH, CID, OUT = sys.argv[1:5]
auto = json.load(open(AUTO)); truth = json.load(open(TRUTH)); cid = json.load(open(CID))
out = {'version': 1, 'hexes': {}, 'saidasPadrao': auto['saidasPadrao']}
for k, h in auto['hexes'].items():
    if k in truth['hexes']:
        out['hexes'][k] = truth['hexes'][k]; continue
    slotted = {c['space'] for c in h['slots'] if c['space']}
    for s in h['spaces']:
        if s['kind'] == 'cidade' and k in cid:
            n, ins, tp, ld, pio, pri = cid[k]
            s['cidade'] = dict(nome=n, insignias=ins, tipoLider=tp, lider=ld, pioneiro=pio, primeiraVisita=pri)
        # Poké-Bola sem carta ao lado = espaço "compre os N próximos" (X2/X3/X4)
        if s['kind'] == 'pokebola' and s['id'] not in slotted:
            esp = {'vermelho': 'compre_2_vermelhos', 'azul': 'compre_3_azuis', 'verde': 'compre_4_verdes'}.get(s['color'])
            if esp: s['kind'] = 'especial'; s['especial'] = esp
    if k == 'E2BR':
        cs = sorted([s for s in h['spaces'] if s['kind'] == 'cidade'], key=lambda s: s['x'])
        cs[0]['kind'] = 'especial'; cs[0]['especial'] = 'planalto'; cs[0].pop('cidade', None)
        cs[1]['kind'] = 'especial'; cs[1]['especial'] = 'comecar_liga'; cs[1].pop('cidade', None)
        for s in h['spaces']:
            if s['kind'] == 'evento' and s['color'] == 'vermelho': s['kind'] = 'especial'; s['especial'] = 'compre_2_eventos'
        h['nota'] = 'rascunho automático — revisar. Falta marcar o sentido único das ligações (setas) e conferir as ligações em volta da Liga.'
    nd = sum(1 for e in h['edges'] if e.get('duvida'))
    if nd and k != 'E2BR': h['nota'] = f'rascunho automático — revisar ({nd} ligação(ões) em laranja para confirmar)'
    out['hexes'][k] = h
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
for k, h in out['hexes'].items():
    ks = {}
    for s in h['spaces']: ks[s.get('especial') or s['kind']] = ks.get(s.get('especial') or s['kind'], 0) + 1
    print(k, ks)
