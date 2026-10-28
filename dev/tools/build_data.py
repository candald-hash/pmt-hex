import json, os, re
P = '/home/claude/pmt-hex'; D = P + '/dados'
J = lambda f: json.load(open(f))
base = lambda f: os.path.splitext(os.path.basename(f))[0]
hexmap = J(P + '/hex-mapa.json')
poke = J(D + '/pokemon.json')['cartas']
for c in poke:
    if c['id'] == 'electrode': c['cor'] = 'verde'
    c['img'] = 'img/pokemon/' + base(c['img']) + '.webp'
    if c['familia'] in ('eevee2', 'slowpoke2'): c['familiaRamificada'] = True
# famílias ramificadas: cada evolução só ganha bônus com a pré-evolução de verdade (não com as "irmãs")
PRE_EVO = {'eevee': [], 'eevee2': [], 'jolteon': ['eevee2', 'eevee'], 'vaporeon': ['eevee2', 'eevee'], 'umbreon': ['eevee2', 'eevee'],
           'slowbro': ['slowpoke2'], 'galarian slowking': ['slowpoke2']}
for c in poke:
    if c['id'] in PRE_EVO: c['preEvo'] = PRE_EVO[c['id']]
for c in poke: c['elencos'] = ['padrao']
# elenco alternativo: cartas novas + as repetidas (iguais às do padrão)
porId = {c['id']: c for c in poke}
for c in J(D + '/pokemon_alt.json')['cartas']:
    if c.get('repetido'): porId[c['id']]['elencos'].append('alt'); continue
    c = dict(c); c['img'] = 'img/pokemon/' + c['id'] + '.webp'; c['elencos'] = ['alt']; poke.append(c)
ids = [c['id'] for c in poke]; assert len(ids) == len(set(ids))
# Efeitos automáticos (o resto fica com a caixa de ferramentas manual)
# passos: itens n | treinador n | ganhar cor n | capturar cor | pular n | tabela [[faces],[passos]] | seTipo tipo [passos] | seCor cor [passos]
AUTO_EV = {
 'bill': [['itens', 3]], 'birch': [['itens', 1]], 'carvalho': [['itens', 3]], 'centro': [['itens', 2], ['treinador', 1]],
 'chairman': [['ganhar', 'azul', 1]], 'elm': [['itens', 2]], 'fossil1': [['ganhar', 'verde', 1]], 'fossil2': [['ganhar', 'verde', 1]],
 'ovopoke': [['ganhar', 'rosa', 1]], 'ovopoke2': [['ganhar', 'rosa', 1]], 'ovopoke3': [['ganhar', 'rosa', 1]],
 'lendario': [['capturar', 'amarelo']], 'lendario2': [['capturar', 'amarelo']], 'map': [], 'kurt': [['itens', 2]],
 'gurudapesca': [['itens', 1], ['seTipo', 'agua', [['itens', 1]]]], 'insetos': [['itens', 1], ['seTipo', 'inseto', [['itens', 1]]]],
 'zinnia': [['itens', 1], ['seTipo', 'dragao', [['itens', 2]]]], 'templo': [['itens', 1], ['seCor', 'amarelo', [['itens', 3]]]],
 'torre': [['ganhar', 'verde', 1], ['pular', 1]], 'silphco': [['itens', 2], ['pular', 1]], 'fuji': [['itens', 3]], 'ruinasdealph': [['itens', 3]],
 'rowan': [['itens', 1], ['treinador', 1]], 'negociador2': [['itens', 1]],
 'cassiino': [['tabela', [[[1], [['itens', 1]]], [[2], [['ganhar', 'rosa', 1]]], [[3], [['itens', 2]]], [[4], [['ganhar', 'verde', 1]]], [[5], [['itens', 3]]], [[6], [['ganhar', 'azul', 1]]]]]],
 'encontroraro': [['tabela', [[[1, 2, 3, 4], [['capturar', 'vermelho']]], [[5, 6], [['capturar', 'amarelo']]]]]],
 'zonadosafari': [['tabela', [[[1], [['capturar', 'verde']]], [[2, 3], [['capturar', 'azul']]], [[4, 5], [['capturar', 'vermelho']]], [[6], [['capturar', 'amarelo']]]]]],
 'pescaria': [['tabela', [[[2, 4, 6], [['ganhar', 'espaco', 1]]], [[1, 3, 5], []]]]],
}
G1_EV = {'impostoroak': 'impostor', 'pokefanssp': 'pokefans', 'esconderijo': 'esconderijo', 'troca': 'troca', 'troca1': 'troca', 'ssanne': 'ssanne', 'copycat2': 'copycat2'}
PREMIO = {'dueloDOJO': 'dojo', 'dueloESTUF': 'estufa', 'dueloGELO': 'gelo', 'dueloVULK': 'vulcao'}
AUTO_EV.update({'copycat': [['dividir']], 'mary': [['dividir']]})
R = lambda m, ordem, premios, nomes, ex=False: ['ranking', {'metrica': m, 'ordem': ordem, 'premios': premios, 'nomes': nomes, 'excluirAtivo': ex}]
AUTO_EV.update({
 'invasaoaq': [['todos', 'aqua']], 'invasaomag': [['todos', 'magma']], 'invasaorocket': [['todos', 'rocket']],
 'colecionador': [R('capturas', 'max', [[['ganhar', 'azul', 1]], [['ganhar', 'verde', 1]], [['ganhar', 'rosa', 1]]], ['Pokémon Azul', 'Pokémon Verde', 'Pokémon Rosa'])],
 'centrodecriacao': [R('forcaMax', 'min', [[['ganhar', 'espaco', 1]]], ['Pokémon da cor do espaço'])],
 'birch': [['itens', 1], R('itens', 'min', [[['itens', 2]]], ['2 Cartas Item'])],
 'carvalho': [['itens', 3], R('capturas', 'max', [[['itens', 2]]], ['2 Cartas Item'], True)],
 'fuji': [['itens', 3], ['alvo', 'dar2', {'bloqueavel': False}], ['alvo', 'dar1', {'bloqueavel': False, 'distinto': True}]],
 'ruinasdealph': [['ruinas']], 'kurt': [['kurt']],
})
SS = lambda **k: ['slotSel', k]
G3_EV = {
 'delibirdfix': [SS(coresDelibird=True, acao='pegar', titulo='Presente de Delibird: pegue de graça um Pokémon da cor do seu espaço')],
 'rotabloqueada': [['rota'], ['pular', 1]],
 'map': [SS(aberta=True, acao='capturar', titulo='Mapa Regional: escolha um Pokémon revelado para tentar capturar', vazio='Não há Pokémon revelado no tabuleiro.')],
 'tempestad': [['tempestade']],
 'pokedex': [SS(aberta=False, coresDistintas='pokedex', acao='revelar', titulo=f'Pokédex: revele um Pokémon ({i}/4, cores diferentes)') for i in range(1, 5)],
 'kimono': [['tipoCor', {'limite': True, 'titulo': 'Kimono Girl: escolha um tipo e uma cor (até a cor do seu espaço)'}]],
 'rowan': [['itens', 1], ['treinador', 1], SS(hex=True, aberta=False, acao='revelar', titulo='Prof. Rowan: revele um Pokémon deste hexágono')],
 'negociador2': [['itens', 1], ['negociador']],
 'proposta_de_n': [['propostaN']],
 'novoinicio': [['novoInicio'], ['itens', 1], ['treinador', 2]],
 'diglett': [['espaco', {'ativar': True, 'titulo': 'Túnel dos Diglett: escolha um espaço deste hexágono'}]],
 'gsball': [['gsball']],
 'ginasio': [['liderFora']],
 'juniper': [['alvo', 'juniper', {'bloqueavel': False}]],
 'festival pokemon': [['festival']],
 'jirachi': [['distribuir', {'n': 3, 'titulo': 'Pedido a Jirachi: distribua os Eventos para jogadores diferentes (pode ser você)'}]],
 'mercador': [['opcao', [{'nome': 'Comprar 1 Item', 'passos': [['itens', 1]]}, {'nome': 'Descartar 1 Item e comprar 2', 'passos': [['pagar', 1, [['itens', 2]], 'Vendedor Viajante: descarte 1 Item']]}], 'Vendedor Viajante']],
}
G3_EV.update({'festivalbatalhas': [['alvo', 'praca', {'bloqueavel': False}]]})
G3_EV.update({'encrenca2': [['efeito', 'encrenca', 2]], 'parquenacional': [['efeito', 'parque', 3]], 'subornorocket': [['efeito', 'suborno', 1]]})
AUTO_EV.update(G3_EV)
G3_SEV = {
 'encontrolendario': [['revelarEscolher', 'amarelo', 4]],
 'expertemfosseis': [['revelarEscolher', 'verde', 3, 2]],
 'maquinadobill': [SS(cores=[c], aberta=False, marcar='bill', acao='revelar', titulo=f'Máquina do Bill: revele um Pokémon {c}') for c in ['rosa', 'verde', 'azul', 'vermelho']]
                  + [SS(marca='bill', aberta=True, excluirMarca='billcap', marcar='billcap', acao='capturar', titulo=f'Máquina do Bill: tente capturar um dos revelados ({i}/2)') for i in (1, 2)],
 'pesquisa': [['tipoCor', {'limite': False, 'titulo': 'Pesquisa de Oak: escolha um tipo e uma cor'}], ['itens', 1]],
 'sabrina': [['sabrina']],
 'brineybarco': [['turnoExtra'], ['efeito', 'briney', 1]],
 'pokenav': [['treinador', 4], ['alvo', 'navTr', {'bloqueavel': True}]],
}
G2_COMPLETO = set(G3_EV) | {'invasaoaq', 'invasaomag', 'invasaorocket', 'colecionador', 'centrodecriacao', 'birch', 'carvalho', 'fuji', 'ruinasdealph', 'kurt'}
AUTO_SEV_G2 = dict(G3_SEV); AUTO_SEV_G2.update({'opgalat': [['itens', 3], ['opcao', [{'nome': 'Um oponente perde os próximos 2 turnos', 'passos': [['alvo', 'pular2', {'bloqueavel': True}]]},
                                               {'nome': 'Dois oponentes perdem o próximo turno', 'passos': [['alvo', 'pular1', {'bloqueavel': True}], ['alvo', 'pular1', {'bloqueavel': True, 'distinto': True}]]}], 'Operação Galactic']]})
AUTO_SEV_G2.update({'criadores': [['criadores']], 'opaqua': [['todos', 'opaqua']], 'opmagma': [['todos', 'opmagma']],
                    'arceus': [['distribuir', {'n': 2, 'baralho': 'superevento', 'titulo': 'Pedido a Arceus: distribua os Super Eventos para 2 jogadores diferentes (pode ser você)'}]]})
AUTO_SEV = {'incubadoras': [['ganhar', 'rosa', 3]], 'fossilgrande': [['ganhar', 'vermelho', 1]], 'missingno': [['itens', 2], ['ganhar', 'azul', 1]],
            'museupokemon': [['itens', 4]], 'opgalat': [['itens', 3]]}
COMPLETO = {'bill','centro','chairman','elm','fossil1','fossil2','ovopoke','ovopoke2','ovopoke3','lendario','lendario2','gurudapesca','insetos','zinnia','templo','torre','silphco','cassiino','encontroraro','zonadosafari','pescaria',
            'incubadoras','fossilgrande','missingno','museupokemon'}
def cards(f, folder, auto):
    d = J(D + '/' + f)
    out = []
    for c in d['cartas']:
        b = base(c['img']); c['id'] = b; c['img'] = f'img/{folder}/{b}.webp'
        if b in auto: c['auto'] = auto[b]
        if b in COMPLETO: c['autoCompleto'] = True
        out.append(c)
    return out, f'img/{folder}/' + base(d['verso']) + '.webp'
ev, ev_back = cards('eventos.json', 'eventos', AUTO_EV)
for c in ev:
    if c['id'] in G1_EV: c['auto'] = [['alvo', G1_EV[c['id']], {'bloqueavel': bool(c.get('bloqueavel'))}]]; c['autoCompleto'] = True
    if c['id'] in PREMIO: c['auto'] = [['alvo', 'duelo', {'bloqueavel': bool(c.get('bloqueavel')), 'mods': c['duelo'], 'premio': PREMIO[c['id']]}]]; c['autoCompleto'] = True
    if c['id'] in ('copycat', 'mary') or c['id'] in G2_COMPLETO: c['autoCompleto'] = True
sev, sev_back = cards('supereventos.json', 'super', AUTO_SEV)
for c in sev:
    if c['id'] in AUTO_SEV_G2: c['auto'] = AUTO_SEV_G2[c['id']]; c['autoCompleto'] = True
    if c['id'] == 'trocapok': c['auto'] = [['alvo', 'troca', {'bloqueavel': True}]]; c['autoCompleto'] = True
    if c['id'] == 'oprocket':
        c['auto'] = [['opcao', [{'nome': 'Pegar 2 Itens aleatórios de um oponente', 'passos': [['alvo', 'roubar2', {'bloqueavel': True}]]},
                                {'nome': 'Pegar 1 Item aleatório de dois oponentes', 'passos': [['alvo', 'roubar1', {'bloqueavel': True}], ['alvo', 'roubar1', {'bloqueavel': True, 'distinto': True}]]}], 'Operação Rocket']]
        c['autoCompleto'] = True
tr, tr_back = cards('treinadores.json', 'treinadores', {})
ld, ld_back = cards('lideres.json', 'lideres', {})
it, it_back = cards('itens.json', 'itens', {})
for c in tr:
    t = c['nome']
    c['efeito'] = {'Alder': 'alder', 'Backpacker': 'backpacker', 'Blue': 'blue', 'Cynthia': 'cynthia', 'Ethan': 'ethan', 'Green': 'green', 'Hiker': 'hiker',
                   'Lyra': 'lyra', 'May': 'may', 'Red': 'red', 'Silver': 'silver', 'Wally': 'wally'}.get(t, 'especialista' if c.get('especialista') else None)
for c in it:
    if 'copias' not in c: c['copias'] = 1
import math
def lado(s):
    a = math.degrees(math.atan2(s['y'] - .5, s['x'] - .5))
    return min([(0, 'L'), (60, 'SE'), (120, 'SO'), (180, 'O'), (-180, 'O'), (-120, 'NO'), (-60, 'NE')], key=lambda v: abs(a - v[0]))[1]
for h in hexmap['hexes'].values():
    for sp in h['spaces']:
        if sp['kind'] == 'porta' and not sp.get('lado'): sp['lado'] = lado(sp)
    ls = [sp['lado'] for sp in h['spaces'] if sp['kind'] == 'porta']
    assert len(ls) == len(set(ls)), (h['id'], ls)
SSc = lambda **k: ['slotSel', k]
Rmin = lambda cor: ['ranking', {'metrica': 'capturas', 'ordem': 'min', 'premios': [[['ganhar', cor, 1]]], 'nomes': ['Pokémon ' + cor.capitalize()], 'excluirAtivo': True}]
CID_PIO = {
 'Motostoke': [SSc(aberta=False, hexDistintos='moto', acao='revelar', titulo=f'Motostoke (Pioneiro): revele um Pokémon — {i}/4, hexágonos diferentes') for i in range(1, 5)],
 'Azalea': [['azalea']],
 'Petalburg': [SSc(aberta=True, cores=['rosa', 'verde', 'azul'], acao='capturar', titulo='Petalburg (Pioneiro): tente capturar um Pokémon Azul ou mais fraco revelado', vazio='Não há Pokémon Azul ou mais fraco revelado.')],
 'Driftveil': [['distribuir']], 'Mistralton': [['distribuir']],
 'Cianwood': [['itens', 4], ['alvo', 'dar2', {'bloqueavel': False}]],
 'Lavaridge': [['ganhar', 'verde', 1], Rmin('verde')],
 'Fortree': [['ganhar', 'azul', 1], Rmin('azul')],
 'Fuchsia': [['fuchsia']],
 'Vermilion': [['alvo', 'troca', {'bloqueavel': True, 'cores': ['rosa']}], ['pular', 1]],
 'Viridian': [['alvo', 'troca', {'bloqueavel': True, 'cores': ['rosa', 'verde']}]],
 'Mahogany': [SSc(hex=True, marcar='maho', excluirMarca='maho', acao='capturar', titulo=f'Mahogany (Pioneiro): tente capturar um Pokémon deste hexágono ({i}/2)') for i in (1, 2)],
 'Sunyshore': [['espaco', {'ativar': False, 'ficar': True, 'titulo': 'Sunyshore (Pioneiro): mova seu peão para qualquer espaço deste hexágono (ou fique)'}]],
}
CID_PRI = {
 'Olivine': [['opcao', [{'nome': 'Descartar 1 Item e comprar um Evento', 'passos': [['pagar', 1, [['evento']], 'Olivine: descarte 1 Item']]}, {'nome': 'Não', 'passos': []}], 'Olivine (Primeira visita)']],
 'Ecruteak': [['opcao', [{'nome': '1 Evento', 'passos': [['evento']]}, {'nome': '2 Cartas Item', 'passos': [['itens', 2]]}, {'nome': '3 Cartas de Treinador', 'passos': [['treinador', 3]]}], 'Ecruteak (Primeira visita)']],
 'Laverre': [['alvo', 'eventoPara', {'bloqueavel': False}]],
 'Blackthorn': [['opcao', [{'nome': 'Comprar um Evento', 'passos': [['evento']]}, {'nome': 'Descartar 1 Item e comprar um Super Evento', 'passos': [['pagar', 1, [['superevento']], 'Blackthorn: descarte 1 Item']]}], 'Blackthorn (Primeira visita)']],
 'Sootopolis': [['especialE', 'compre_2_eventos']],
}
for h in hexmap['hexes'].values():
    for sp in h['spaces']:
        c = sp.get('cidade')
        if not c: continue
        if c.get('nome') in CID_PIO: c['pioneiroAuto'] = CID_PIO[c['nome']]
        if c.get('nome') in CID_PRI: c['primeiraAuto'] = CID_PRI[c['nome']]
hexes = {}
for k, h in hexmap['hexes'].items():
    hexes[k] = dict(id=k, tier=h['tier'], w=h['w'], h=h['h'], img=f'img/hex/{k}.webp',
                    spaces=[{kk: v for kk, v in s.items() if kk in ('id', 'x', 'y', 'kind', 'color', 'tipo', 'cidade', 'especial', 'lado')} for s in h['spaces']],
                    slots=[{kk: v for kk, v in s.items() if kk in ('id', 'x', 'y', 'color', 'space')} for s in h['slots']],
                    edges=[{kk: v for kk, v in e.items() if kk in ('a', 'b', 'dir', 'itemCost')} for e in h['edges']])
DATA = dict(hexes=hexes, pokemon=poke, elencos={'padrao': 'Balanceado (padrão)', 'alt': 'Alternativo'}, eventos=ev, supereventos=sev, treinadores=tr, lideres=ld, itens=it,
            versos=dict(evento=ev_back, superevento=sev_back, treinador=tr_back, lider=ld_back, item=it_back,
                        **{c: f'img/pokemon/verso_{c}.webp' for c in ['inicial', 'rosa', 'verde', 'azul', 'vermelho', 'amarelo']}),
            pads={c: f'img/pads/{c}.webp' for c in ['branco', 'preto', 'vermelho', 'azul', 'verde', 'amarelo']})
os.makedirs(P + '/web/js', exist_ok=True)
open(P + '/web/js/data.js', 'w').write('// gerado por tools/build_data.py\nwindow.DATA = ' + json.dumps(DATA, ensure_ascii=False) + ';\n')
print('ok', len(poke), len(ev), len(sev), len(tr), len(ld), len(it), os.path.getsize(P + '/web/js/data.js') // 1024, 'KB')
