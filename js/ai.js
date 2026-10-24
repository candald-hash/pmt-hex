// IA dos adversários: decide uma ação por vez, usando só a API do motor.
(function (G) {
  'use strict';
  const E = G.Engine;
  const VAL_COR = { inicial: 4, rosa: 2, verde: 4, azul: 6, vermelho: 8, amarelo: 11 };
  const ORDEM = ['rosa', 'verde', 'azul', 'vermelho', 'amarelo'];

  // ---------- probabilidades ----------
  function pCaptura(st, p, id, bola, slot) {
    const c = E.P(id); if (!c.captura.length) return 0;
    const R = E.faixaCaptura(st, p, id, bola, slot);
    let q = 0; for (let d = 1; d <= 6; d++) { for (let m = -R; m <= R; m++) if (c.captura.includes(d + m)) { q++; break; } }
    q /= 6; const t = p.treinador && E.idx().tr[p.treinador]; const k = t && t.efeito === 'red' ? 2 : 1;
    return 1 - Math.pow(1 - q, k);
  }
  function pFaces(p, faces, R, dados) { let q = 0; for (let d = 1; d <= 6; d++) { for (let m = -R; m <= R; m++) if (faces.includes(d + m)) { q++; break; } } q /= 6; return 1 - Math.pow(1 - q, dados); }
  function pVitoria(diff) { // diff = força do jogador sem dado − força do adversário; vence se dado ≥ −diff
    const need = -diff; if (need <= 1) return 1; if (need > 6) return 0; return (7 - need) / 6;
  }
  // valor de um Pokémon para o time: força + sinergia com a família
  function valorPokemon(p, id) {
    const c = E.P(id); let v = c.forca;
    if (c.familia && p.pokemon.some(x => x !== id && E.P(x).familia === c.familia)) v += 3;
    if (!E.obedece(p, c.cor)) v -= 2;
    return v;
  }
  function valorItem(inst) {
    const it = E.ITEM(inst); if (it.bola) return 2 + it.bola; if (it.uso === 'batalha' && it.bonus) return it.bonus + (it.tipos ? -1 : 0);
    return { potion: 4, pokedollblock: 4, bike1: 3, pedidocelebi: 3, voar: 3, potedemel: 3, doceraro: 3 }[it.id] || 2;
  }
  function valorTreinador(p, id) {
    const t = E.idx().tr[id]; if (!t) return 0;
    if (t.especialista) return 1 + 1.5 * p.pokemon.filter(x => E.P(x).tipos.some(y => t.especialista.includes(y))).length;
    const cont = cor => p.pokemon.filter(x => E.P(x).cor === cor).length;
    return { alder: 4 + p.pokemon.length * 0.5, ethan: 1 + 1.2 * cont('azul'), may: 1 + 2 * cont('verde'), blue: 4, red: 5, green: 3.5, hiker: 1.5, backpacker: 2.5, silver: 2.5, wally: 2, lyra: 1.5, cynthia: 2.5 }[t.efeito] || 2;
  }

  // melhor escalação contra um Líder: retorna {pk, it, p}
  function planoLider(st, p, L) {
    const n = L.dual ? 2 : 1;
    const aptos = p.pokemon.filter(id => E.obedece(p, E.P(id).cor));
    if (aptos.length < n) return null;
    const f = id => E.forcaBase(p, id) + E.bonusTreinador(p, id) + E.vantagem(E.P(id).vantagens, [L.tipo]) - E.vantagem(L.vantagens, E.P(id).tipos);
    const pk = aptos.slice().sort((a, b) => f(b) - f(a)).slice(0, n);
    let soma = pk.reduce((s, id) => s + f(id), 0);
    // itens de batalha: um por Pokémon, o de maior bônus aplicável, só se precisar
    const its = p.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus).sort((a, b) => E.ITEM(b).bonus - E.ITEM(a).bonus);
    const usados = [], it = pk.map(() => null);
    pk.forEach((id, k) => {
      if (pVitoria(soma - L.forca) >= 0.84) return;
      const cand = its.find(i => !usados.includes(i) && E.bonusItemBatalha(i, id) > 0);
      if (cand) { usados.push(cand); it[k] = cand; soma += E.bonusItemBatalha(cand, id); }
    });
    return { pk, it, p: pVitoria(soma - L.forca) };
  }
  function liderUtil(st, p, k) {
    const lid = st.lideres[k]; if (!lid) return null; const L = E.idx().ld[lid];
    if (!E.podeEnfrentar(p, L)) return null;
    const pl = planoLider(st, p, L); return pl ? { L, pl } : null;
  }

  // ---------- movimento ----------
  function tierAlvo(p) { const n = E.nInsignias(p); return n < 2 ? 't1' : n < 4 ? 't2' : n < 6 ? 't3' : 'fim'; }
  function distancias(st, origem) { // BFS simples ignorando regras de dado
    const g = E.grafo(st), dist = { [origem]: 0 }, fila = [origem];
    while (fila.length) { const k = fila.shift(); for (const { to } of g.adj[k] || []) if (dist[to] == null) { dist[to] = dist[k] + (['porta', 'passagem'].includes(g.nodes[to].kind) ? 0 : 1); fila.push(to); } }
    return dist;
  }
  function pontuarDestino(st, p, k, info) {
    const g = E.grafo(st), s = g.nodes[k], tier = G.DATA.hexes[s.hex].tier; let v = 0;
    if (s.kind === 'cidade') { const u = liderUtil(st, p, k); if (u) v += 20 + 90 * u.pl.p; if (!p.visitou.includes(k)) v += 8; if (s.cidade && s.cidade.pioneiro && st.pioneiros[k] == null) v += 6; }
    else if (s.kind === 'pokebola') {
      const slot = Object.values(g.slots).find(x => x.espaco === k), c = slot && st.slots[slot.key];
      if (c && c.carta) {
        if (c.aberta) { const id = c.carta; v += pCaptura(st, p, id, null, slot.key) * (valorPokemon(p, id) * 4); }
        else v += pFaces(p, { rosa: [2, 3, 4, 5], verde: [3, 4, 5], azul: [4, 5], vermelho: [5], amarelo: [6] }[slot.cor] || [], 0, 1) * VAL_COR[slot.cor] * 4;
      }
    }
    else if (s.kind === 'evento') v += 12; else if (s.kind === 'superevento') v += 28;
    else if (s.kind === 'especial') v += ({ planalto: 200, comecar_liga: st.liga ? (['duas', 'tres', 'semisEspera'].includes(st.liga.etapa) && st.liga.ativos.includes(p.id) ? 300 : 4) : g.loopE2.every(x => p.e2.includes(x)) ? 300 : 6, compre_2_eventos: 18 }[s.especial] || 22);
    else if (s.kind === 'passagem') v += 2;
    if (info.custo) v -= info.custo * 6;
    // aproximar-se do próximo objetivo (cidade com líder útil no tier certo, ou o Planalto)
    const alvo = tierAlvo(p), dist = distancias(st, k);
    let melhor = 99;
    Object.keys(st.lideres).forEach(c => { const n = g.nodes[c]; if (!n) return; const t = G.DATA.hexes[n.hex].tier; if ((t === alvo || alvo === 'fim') && liderUtil(st, p, c) && dist[c] != null) melhor = Math.min(melhor, dist[c]); });
    if (alvo === 'fim') Object.values(g.nodes).filter(n => n.especial === 'planalto' || n.especial === 'comecar_liga').forEach(n => { if (dist[n.key] != null) melhor = Math.min(melhor, dist[n.key]); });
    if (melhor < 99) v -= melhor * 2.5;
    if (tier === alvo) v += 6;
    return v + Math.random() * 2;
  }


  // ---------- decisões do grupo 1 ----------
  const forcaMax = (st, q) => Math.max(0, ...q.pokemon.filter(id => E.obedece(q, E.P(id).cor)).map(id => E.forcaBase(q, id) + E.bonusTreinador(q, id)));
  function decidirAlvo(st) {
    const pd = st.pend, p = E.J(st); const ops = pd.opcoes.map(i => E.J(st, i));
    const score = q => {
      switch (pd.acao) {
        case 'impostor': return q.itens.length - p.itens.length;
        case 'roubar1': case 'roubar2': return q.itens.length + (E.temBoneca(q) ? -5 : 0);
        case 'pokefans': return valorTreinador(p, q.treinador) - valorTreinador(p, p.treinador);
        case 'esconderijo': return E.nInsignias(q) + valorTreinador(q, q.treinador) / 3;
        case 'troca': case 'ssanne': return Math.max(...E.paresTroca(p, q, pd.cores).map(([a, b]) => valorPokemon(p, b) - valorPokemon(p, a)));
        case 'duelo': return -forcaMax(st, q);
        case 'praca': return -forcaPraca(st, q);
        case 'navPlus': return q.id === p.id ? 3 - valorTreinador(p, p.treinador) : valorTreinador(q, q.treinador) - 3 - (E.temBoneca(q) ? 3 : 0);
        case 'juniper': return q.itens.length * 2 - E.nInsignias(q);
        case 'eventoPara': case 'eventoCarta':
        case 'dar2': case 'dar1': return -(E.nInsignias(q) * 2 + q.pokemon.length);
        case 'pular2': case 'pular1': return E.nInsignias(q) * 3 + q.pokemon.length - (E.temBoneca(q) ? 4 : 0);
        case 'copycat2': return E.nInsignias(q) * 2 + (E.grafo(st).nodes[q.pos] && { t1: 1, t2: 2, t3: 3, fim: 4 }[G.DATA.hexes[E.grafo(st).nodes[q.pos].hex].tier] || 0);
      }
      return 0;
    };
    return ops.sort((a, b) => score(b) - score(a) + (Math.random() - 0.5) * 0.01)[0].id;
  }
  function decidirBoneca(st) {
    const pd = st.pend, resp = E.J(st, pd.respondente);
    const souAlvo = pd.respondente === pd.alvo;
    if (pd.modo === 'todos') {
      if (!souAlvo) return pd.acaoId === 'rocket' && pd.bloqueado;
      if (pd.bloqueado) return false;
      if (pd.acaoId === 'aqua') return resp.itens.length >= 3;
      if (pd.acaoId === 'opaqua') return false;
      if (pd.acaoId === 'opmagma') return valorTreinador(resp, resp.treinador) >= 3;
      if (pd.acaoId === 'magma') return valorTreinador(resp, resp.treinador) >= 3.5;
      return true;
    }
    // alvo quer bloquear (estado atual = não bloqueado); atacante quer desfazer o bloqueio
    if (souAlvo && pd.bloqueado) return false;
    if (!souAlvo && !pd.bloqueado) return false;
    if (pd.acao === 'pokefans' && souAlvo) { const atk = E.J(st); return valorTreinador(resp, resp.treinador) > valorTreinador(resp, atk.treinador); }
    if (pd.acao === 'copycat2') return false;
    if (pd.acao === 'duelo') { const a = E.J(st, pd.alvo), b = E.J(st); return souAlvo ? forcaMax(st, a) < forcaMax(st, b) : true; }
    return true;
  }
  function escolhaDuelo(st, lado) {
    const pd = st.pend, q = E.J(st, pd[lado]), ap = E.aptosDuelo(st, pd, lado);
    const f = id => E.forcaEmBatalha(st, q.id, id, null, [], pd.mods);
    const pk = ap.slice().sort((a, b) => f(b) - f(a))[0];
    const its = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.bonusItemBatalha(i, pk) > 0).sort((a, b) => E.bonusItemBatalha(b, pk) - E.bonusItemBatalha(a, pk));
    return { pokemon: pk, item: its.length >= 2 || (its.length && pd.premio !== 'dojo') ? its[0] : null };
  }
  function decidirTroca(st) {
    const pd = st.pend, p = E.J(st), q = E.J(st, pd.com);
    return E.paresTroca(p, q, pd.cores).sort((x, y) => (valorPokemon(p, y[1]) - valorPokemon(p, y[0])) - (valorPokemon(p, x[1]) - valorPokemon(p, x[0])))[0];
  }


  // ---------- decisões do grupo 3 ----------
  function valorSlot(st, p, k) {
    const c = st.slots[k]; if (!c || !c.carta) return 0;
    const g = E.grafo(st), cor = E.P(c.carta).cor;
    return c.aberta ? valorPokemon(p, c.carta) : (VAL_COR[cor] || 3);
  }
  function decidirSlot(st) {
    const pd = st.pend, p = E.J(st), a = pd.f.acao;
    const sc = k => a === 'pegar' ? valorSlot(st, p, k) : a === 'capturar' ? pCaptura(st, p, st.slots[k].carta, null, k) * valorSlot(st, p, k) : Math.random();
    return pd.opcoes.slice().sort((x, y) => sc(y) - sc(x))[0];
  }
  function decidirTipoCor(st) {
    const pd = st.pend, p = E.J(st), cor = pd.cores[pd.cores.length - 1];
    // tipo que já existe no time (sinergia de treinador) ou o mais comum no baralho dessa cor
    const t = p.treinador && E.idx().tr[p.treinador];
    const cont = {}; st.decks[cor].forEach(id => E.P(id).tipos.forEach(x => cont[x] = (cont[x] || 0) + 1));
    let tipo = Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0];
    if (t && t.especialista) { const e = t.especialista.find(x => cont[x]); if (e) tipo = e; }
    return [tipo || 'normal', cor];
  }
  function decidirPagamento(st) { const pd = st.pend, p = E.J(st); return p.itens.slice().sort((a, b) => valorItem(a) - valorItem(b)).slice(0, pd.n); }
  function decidirNegociador(st) {
    const p = E.J(st), por = {};
    p.pokemon.forEach(id => { const c = E.P(id); if (c.cor === 'inicial' || c.cor === 'amarelo') return; const temFam = c.familia && p.pokemon.some(x => x !== id && E.P(x).familia === c.familia); if (!temFam && !E.familiaTravada(p, id)) (por[c.cor] = por[c.cor] || []).push(id); });
    const cor = ['rosa', 'verde'].find(c => (por[c] || []).length >= 2);
    return cor ? por[cor].sort((a, b) => valorPokemon(p, a) - valorPokemon(p, b)).slice(0, 2) : null;
  }

  function decidirBriney(st) {
    const pd = st.pend, quem = E.J(st, st.vez), dono = E.J(st, pd.dono);
    const melhor = d => { const ds = E.destinos(st, st.vez, Math.max(1, pd.valor + d)); const vs = Object.entries(ds).map(([k, i]) => pontuarDestino(st, quem, k, i)); return vs.length ? Math.max(...vs) : -50; };
    const op = [-1, 0, 1].map(d => ({ d, v: melhor(d) }));
    op.sort((a, b) => quem.id === dono.id ? b.v - a.v : a.v - b.v);
    return op[0].d;
  }
  function decidirJuniper(st) { const d = E.J(st, st.pend.doador); return d.itens.slice().sort((a, b) => valorItem(a) - valorItem(b))[0]; }
  function decidirFestival(st) {
    const pd = st.pend, q = E.J(st, pd.jogador);
    const cand = q.pokemon.filter(id => !pd.trocados.includes(id) && st.decks[E.P(id).cor] && st.decks[E.P(id).cor].length && !E.familiaTravada(q, id))
      .filter(id => { const c = E.P(id); return !(c.familia && q.pokemon.some(x => x !== id && E.P(x).familia === c.familia)) && c.forca < (VAL_COR[c.cor] || 0); })
      .sort((a, b) => valorPokemon(q, a) - valorPokemon(q, b));
    return cand[0] || null;
  }
  function bomEvento(card) { const a = JSON.stringify(card.auto || []); if (!card.autoCompleto) return 0; let v = 0; if (/ganhar|capturar/.test(a)) v += 3; if (/itens|treinador|superevento/.test(a)) v += 2; if (/pular|todos/.test(a)) v -= 3; return v; }
  // ---------- Festival de Praça ----------
  function forcaPraca(st, q) { return E.pracaAptosDe(q).map(id => E.pracaForca(st, q.id, id, null, []).forca).sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0); }
  function duplaPraca(st, lado) {
    const pd = st.pend, q = E.J(st, pd[lado]), opT = []; // escolha secreta: não vê a dupla do adversário
    const ids = E.pracaAptosDe(q).sort((x, y) => E.pracaForca(st, q.id, y, null, opT).forca - E.pracaForca(st, q.id, x, null, opT).forca).slice(0, 2);
    const livres = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus), itens = {};
    ids.forEach(id => { const best = livres.filter(i => E.bonusItemBatalha(i, id) > 0).sort((a, b) => E.bonusItemBatalha(b, id) - E.bonusItemBatalha(a, id))[0]; if (best) { itens[id] = best; livres.splice(livres.indexOf(best), 1); } });
    return { ids, itens };
  }
  function premioPraca(st) { const q = E.J(st); return E.obedece(q, 'azul') ? 'azul' : q.pokemon.length < 6 ? 'verde' : 'itens'; }
  // ---------- Repel ----------
  // troca um Pokémon que a própria IA vai tentar capturar e não vale a pena, ou tira do caminho um Pokémon valioso para o adversário
  function decidirRepel(st, j) {
    const pd = st.pend, q = E.J(st, j), dep = pd.depois;
    for (const k of pd.slots) {
      const id = st.slots[k] && st.slots[k].carta; if (!id) continue;
      const cap = dep && dep.tipo === 'captura' && dep.slot === k ? E.J(st) : null;
      if (cap && cap.id === j) { if (valorPokemon(q, id) < 4 || pCaptura(st, q, id, null, k) < 0.2) return k; continue; }
      if (cap) { if (valorPokemon(cap, id) >= 7 && pCaptura(st, cap, id, null, k) >= 0.3 && Math.random() < 0.6) return k; continue; }
    }
    return 'nao';
  }
  // ---------- Cynthia ----------
  function decidirCynthia(st) { const pd = st.pend, q = E.J(st, pd.respondente); return pCaptura(st, q, pd.carta, null, pd.slot) > 0; }
  // ---------- Liga ----------
  // reação de uma IA depois de um duelo da Liga: Remédio ou Pedido a Celebi; null se não quiser
  function reacaoLiga(st) {
    const pd = st.pend, r = pd.resultado, d = pd.duelos[pd.duelos.length - 1]; if (!r || !d) return null;
    for (const l of ['a', 'b']) {
      const q = E.J(st, pd[l]); if (!q.ia || d.venc === l) continue;
      const outro = l === 'a' ? 'b' : 'a', meu = l === 'a' ? r.da : r.db, dele = l === 'a' ? r.db : r.da;
      const perdeuBatalha = pd.vencLado === outro, pk = l === 'a' ? d.pa : d.pb;
      const forte = E.ligaAptos(st, pd, l).every(id => E.forcaBase(q, id) <= E.forcaBase(q, pk));
      if (q.itens.some(i => i.startsWith('potion#')) && (perdeuBatalha || forte)) return { tipo: 'remedio', lado: l };
      if (E.celebiDe(q) && (perdeuBatalha || forte)) { if (meu <= 3) return { tipo: 'celebi', quem: l, lado: l }; if (dele >= 4) return { tipo: 'celebi', quem: l, lado: outro }; }
    }
    return null;
  }
  function aplicarReacaoLiga(st, a) { if (a.tipo === 'remedio') E.ligaRemedio(st, a.lado); else E.ligaCelebi(st, a.quem, a.lado); }
  function forcaTrio(st, q) { return q.pokemon.filter(id => E.obedece(q, E.P(id).cor)).map(id => E.forcaBase(q, id) + E.bonusTreinador(q, id)).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0); }
  function oponenteLiga(st) { const pd = st.pend; return pd.opcoes.slice().sort((a, b) => forcaTrio(st, E.J(st, a)) - forcaTrio(st, E.J(st, b)))[0]; }
  function escolhaLiga(st, lado) {
    const pd = st.pend, q = E.J(st, pd[lado]), outro = lado === 'a' ? 'b' : 'a';
    const opTipos = pd.ativo[outro] ? E.P(pd.ativo[outro]).tipos : [];
    let pk = (pd.forcado && pd.forcado[lado]) || pd.ativo[lado];
    if (!pk) pk = E.ligaAptos(st, pd, lado).sort((x, y) => E.forcaEmBatalha(st, q.id, y, null, opTipos) - E.forcaEmBatalha(st, q.id, x, null, opTipos))[0];
    const its = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus && E.bonusItemBatalha(i, pk) > 0).sort((a, b) => E.bonusItemBatalha(b, pk) - E.bonusItemBatalha(a, pk));
    return { pokemon: pk, item: its[0] || null };
  }
  function decidirReacao(st, j) {
    const pd = st.pend, R = pd.reacao, q = E.J(st, j), card = (pd.baralho === 'evento' ? E.idx().ev : E.idx().sev)[pd.carta], ops = R.opcoes[j], b = bomEvento(card);
    if (ops.includes('flauta')) { if (R.ativador === j && b < 0) return 'flauta'; if (R.ativador !== j && b >= 3 && E.nInsignias(E.J(st, R.ativador)) >= E.nInsignias(q) && Math.random() < 0.5) return 'flauta'; }
    if (ops.includes('exp') && b >= 2) return 'exp';
    if (ops.includes('may') && (b >= 3 || (b >= 2 && valorTreinador(q, q.treinador) < 3))) return 'may';
    return 'nao';
  }
  // ---------- uma ação ----------
  // retorna 'esperar' quando precisa de um humano (efeito manual de carta), senão true se agiu
  function passo(st) {
    if (st.vencedor != null) return false;
    const p = E.J(st); if (!p.ia) return false;
    const pd = st.pend;
    if (pd) {
      if (pd.tipo === 'captura') {
        if (!pd.resultado) {
          const bolas = p.itens.filter(i => E.ITEM(i).bola).sort((a, b) => E.ITEM(a).bola - E.ITEM(b).bola);
          const base = pCaptura(st, p, pd.carta, null, pd.slot), worth = valorPokemon(p, pd.carta);
          let usar = null;
          if (base < 0.99 && worth >= 4) for (const b of bolas) { if (pCaptura(st, p, pd.carta, b, pd.slot) - base >= 0.17) { usar = b; break; } }
          if (!usar && worth >= 9 && bolas.length && base < 0.6) usar = bolas[bolas.length - 1];
          E.rolarCaptura(st, usar); return true;
        }
        if (!pd.resultado.ok && E.celebiDe(p) && !pd.resultado.celebi && valorPokemon(p, pd.carta) >= 6) { E.celebiCaptura(st); return true; }
        E.fecharPend(st); return true;
      }
      if (pd.tipo === 'tabelaRes') { if (!pd.ok) E.celebiTabela(st); else E.aceitarTabela(st); return true; }
      if (pd.tipo === 'carta') {
        const card = (pd.baralho === 'evento' ? E.idx().ev : E.idx().sev)[pd.carta];
        if (!pd.ativado && pd.reacao == null) { E.iniciarReacoes(st); return true; }
        if (E.reacaoAberta(st)) { const R = pd.reacao; const iaPend = Object.keys(R.opcoes).filter(j => R.resp[j] == null && E.J(st, +j).ia); if (iaPend.length) { E.reagir(st, +iaPend[0], decidirReacao(st, +iaPend[0])); return true; } return 'esperar'; }
        if (!pd.ativado) { if (card.auto && card.auto.length) { E.ativarCarta(st); return true; } pd.ativado = true; }
        if (card.autoCompleto) { E.concluirCarta(st); return true; }
        return 'esperar';
      }
      if (pd.tipo === 'escolherCaptura') { const best = pd.cartas.slice().sort((a, b) => pCaptura(st, p, b) * valorPokemon(p, b) - pCaptura(st, p, a) * valorPokemon(p, a))[0]; E.escolherCaptura(st, best); return true; }
      if (pd.tipo === 'escolherEvento') { const best = pd.cartas.slice().sort((a, b) => (E.idx().ev[b].autoCompleto ? 1 : 0) - (E.idx().ev[a].autoCompleto ? 1 : 0))[0]; E.escolherEvento(st, best); return true; }
      if (pd.tipo === 'treinador') { if (!E.J(st, pd.jogador).ia) return 'esperar'; const q = E.J(st, pd.jogador); const op = [q.treinador, ...q.treinadoresExtra].filter(Boolean); E.escolherTreinador(st, op.sort((a, b) => valorTreinador(q, b) - valorTreinador(q, a))[0]); return true; }
      if (pd.tipo === 'preso') { E.confirmarPreso(st); return true; }
      if (pd.tipo === 'proposta') { if (!E.J(st, pd.para).ia) return 'esperar'; E.responderProposta(st, false); return true; }
      if (pd.tipo === 'travar') {
        const q = E.J(st, pd.jogador != null ? pd.jogador : st.vez);
        const fams = {}; q.pokemon.forEach(id => { const f = E.P(id).familia || id; fams[f] = Math.max(fams[f] || 0, E.forcaBase(q, id) + (q.travadas.includes(f) ? -100 : 0)); });
        E.travar(st, Object.keys(fams).sort((a, b) => fams[b] - fams[a])[0]); return true;
      }
      if (pd.tipo === 'lider') {
        if (!pd.resultado) { const L = E.idx().ld[pd.lider], pl = planoLider(st, p, L); if (!pl) { E.fecharPend(st); return true; } E.lutarLider(st, pl.pk, pl.it); return true; }
        if (!pd.resultado.ok && E.celebiDe(p) && !pd.resultado.celebi && pd.resultado.lider - (pd.resultado.total - pd.resultado.dado) <= 5) { E.celebiLider(st); return true; }
        if (!pd.resultado.ok) { const rem = p.itens.find(i => i.startsWith('potion#')); if (rem && pd.resultado.lider - pd.resultado.total <= 4) { E.remedio(st, rem); return true; } }
        E.fecharPend(st); return true;
      }
      if (pd.tipo === 'alvo') { E.escolherAlvo(st, decidirAlvo(st)); return true; }
      if (pd.tipo === 'boneca') { if (!E.J(st, pd.respondente).ia) return 'esperar'; E.responderBoneca(st, decidirBoneca(st)); return true; }
      if (pd.tipo === 'troca') { const [a, b] = decidirTroca(st); E.resolverTroca(st, a, b); return true; }
      if (pd.tipo === 'dividir') { E.resolverDividir(st, pd.itens.slice().sort((a, b) => valorItem(b) - valorItem(a))[0]); return true; }
      if (pd.tipo === 'opcao' && pd.titulo === 'Proposta de N') { E.escolherOpcao(st, p.itens.length >= 3 && pd.opcoes.length === 3 ? 1 : p.itens.length >= 2 ? 0 : pd.opcoes.length - 1); return true; }
      if (pd.tipo === 'opcao' && pd.titulo === 'Vendedor Viajante') { E.escolherOpcao(st, p.itens.length ? 1 : 0); return true; }
      if (pd.tipo === 'opcao' && /Ecruteak/.test(pd.titulo)) { E.escolherOpcao(st, 1); return true; }
      if (pd.tipo === 'opcao' && /Olivine/.test(pd.titulo)) { E.escolherOpcao(st, p.itens.length >= 2 ? 0 : 1); return true; }
      if (pd.tipo === 'opcao' && /Blackthorn/.test(pd.titulo)) { E.escolherOpcao(st, p.itens.length >= 2 ? 1 : 0); return true; }
      if (pd.tipo === 'azalea') { const bom = c => (E.idx().ev[c].autoCompleto ? 2 : 0) + ((E.idx().ev[c].auto || []).some(x => x[0] === 'ganhar') ? 2 : 0); E.resolverAzalea(st, pd.cartas.slice().sort((a, b) => bom(b) - bom(a))[0]); return true; }
      if (pd.tipo === 'campeao') return false;
      if (pd.tipo === 'repel') { const ia = pd.opcoes.find(x => pd.resp[x] == null && E.J(st, x).ia); if (ia != null) { E.reagirRepel(st, ia, decidirRepel(st, ia)); return true; } return 'esperar'; }
      if (pd.tipo === 'cynthia') { if (!E.J(st, pd.respondente).ia) return 'esperar'; E.responderCynthia(st, decidirCynthia(st)); return true; }
      if (pd.tipo === 'praca') {
        if (pd.resultado) { if (!E.J(st, pd.a).ia || !E.J(st, pd.b).ia) return 'esperar'; E.fecharPraca(st); return true; }
        for (const l of ['a', 'b']) if (!pd.dupla[l] && E.J(st, pd[l]).ia) { const d = duplaPraca(st, l); E.escolherDuplaPraca(st, l, d.ids, d.itens); return true; }
        return 'esperar';
      }
      if (pd.tipo === 'pracaPremio') { E.resolverPracaPremio(st, premioPraca(st)); return true; }
      if (pd.tipo === 'liga') { E.fecharPend(st); return true; }
      if (pd.tipo === 'ligaOponente') { if (!E.J(st, pd.escolhe).ia) return 'esperar'; E.resolverLigaOponente(st, oponenteLiga(st)); return true; }
      if (pd.tipo === 'ligaBatalha') {
        if (pd.resultado) { const re = reacaoLiga(st); if (re) { aplicarReacaoLiga(st, re); return true; } }
        if (pd.resultado || pd.vencLado) { if ([pd.a, pd.b].some(j => !E.J(st, j).ia)) return 'esperar'; E.ligaSeguir(st); return true; }
        for (const l of ['a', 'b']) if (!pd.esc[l] && E.J(st, pd[l]).ia) { const e = escolhaLiga(st, l); E.ligaEscolher(st, l, e.pokemon, e.item); return true; }
        return 'esperar';
      }
      if (pd.tipo === 'wally') { const pior = E.J(st).itens.slice().sort((a, b) => valorItem(a) - valorItem(b))[0]; E.resolverWally(st, pior && valorItem(pior) < 3 ? pior : null); return true; }
      if (pd.tipo === 'aquaCompra') { const best = pd.pool.slice().sort((a, b) => valorItem(b) - valorItem(a))[0]; E.comprarAqua(st, best && valorItem(best) >= 3 ? best : 'pilha'); return true; }
      if (pd.tipo === 'criadores') {
        const p = E.J(st); let melhor = null;
        for (const op of [1, 2]) for (const linha of E.linhasCriadores(p, op === 1 ? 2 : 3)) {
          const desc = linha.slice().sort((a, b) => E.P(a).forca - E.P(b).forca).slice(0, op === 1 ? 2 : 3);
          const alvo = E.foraDeJogoCriadores(st, op).sort((a, b) => E.P(b).forca - E.P(a).forca)[0]; if (!alvo) continue;
          const ganho = E.P(alvo).forca - Math.max(...desc.map(id => E.P(id).forca)) - (linha.length - desc.length >= 1 ? 0 : 2);
          if (ganho >= 2 && (!melhor || ganho > melhor.ganho)) melhor = { op, desc, alvo, ganho };
        }
        if (melhor) E.resolverCriadores(st, melhor.op, melhor.desc, melhor.alvo); else E.resolverCriadores(st, 3); return true;
      }
      if (pd.tipo === 'magmaTroca') { const p = E.J(st), best = pd.opcoes.slice().sort((a, b) => valorTreinador(p, b) - valorTreinador(p, a))[0]; E.resolverMagma(st, valorTreinador(p, best) > valorTreinador(p, p.treinador) ? best : null); return true; }
      if (pd.tipo === 'distribuir') { const IX = pd.baralho === 'superevento' ? E.idx().sev : E.idx().ev; const bom = c => (IX[c].autoCompleto ? 2 : 0) + ((IX[c].auto || []).some(x => x[0] === 'ganhar' || x[0] === 'itens') ? 2 : 0); const j = pd.jogadores.find(x => pd.atribuido[x] == null && x === st.vez) ?? pd.jogadores.find(x => pd.atribuido[x] == null); const cs = pd.cartas.slice().sort((a, b) => bom(b) - bom(a)); E.distribuirEvento(st, j, j === st.vez ? cs[0] : cs[cs.length - 1]); return true; }
      if (pd.tipo === 'juniper') { if (!E.J(st, pd.doador).ia) return 'esperar'; E.resolverJuniper(st, decidirJuniper(st)); return true; }
      if (pd.tipo === 'festival') { if (!E.J(st, pd.jogador).ia) return 'esperar'; E.resolverFestival(st, decidirFestival(st)); return true; }
      if (pd.tipo === 'fuchsia') { E.resolverFuchsia(st, pd.cartas.slice().sort((a, b) => valorPokemon(p, b) - valorPokemon(p, a))[0]); return true; }
      if (pd.tipo === 'opcao') { const q = st.jogadores.filter(x => x.id !== st.vez && x.itens.length); E.escolherOpcao(st, q.length >= 2 && !q.some(x => x.itens.length >= 4) ? 1 : 0); return true; }
      if (pd.tipo === 'duelo') {
        const r = pd.resultado;
        if (r && r.det && !r.celebi && E.J(st, pd.a).ia && E.celebiDe(E.J(st, pd.a)) && r.venc !== pd.a) { E.celebiDuelo(st, r.da <= 3 || r.db <= 2 ? 'a' : 'b'); return true; }
        if (pd.resultado && (pd.resultado.venc != null || pd.resultado.fim)) { E.fecharDuelo(st); return true; }
        for (const l of ['a', 'b']) if (!(pd.escolhas && pd.escolhas[l]) && E.J(st, pd[l]).ia) { E.escolherDuelo(st, l, escolhaDuelo(st, l)); return true; }
        return 'esperar';
      }
      if (pd.tipo === 'briney') { if (!E.J(st, pd.dono).ia) return 'esperar'; E.resolverBriney(st, decidirBriney(st)); return true; }
      if (pd.tipo === 'slot') { E.escolherSlot(st, decidirSlot(st)); return true; }
      if (pd.tipo === 'tipoCor') { const [t, c] = decidirTipoCor(st); E.resolverTipoCor(st, t, c); return true; }
      if (pd.tipo === 'pegarDeLista') { E.pegarDeLista(st, pd.cartas.slice().sort((a, b) => valorPokemon(p, b) - valorPokemon(p, a))[0]); return true; }
      if (pd.tipo === 'espaco') { const ds = {}; pd.opcoes.forEach(k => ds[k] = {}); E.escolherEspaco(st, pd.opcoes.slice().sort((a, b) => pontuarDestino(st, p, b, {}) - pontuarDestino(st, p, a, {}))[0]); return true; }
      if (pd.tipo === 'escolherLider') { const best = pd.opcoes.map(id => ({ id, pl: planoLider(st, p, E.idx().ld[id]) })).sort((a, b) => (b.pl ? b.pl.p : 0) - (a.pl ? a.pl.p : 0))[0]; E.escolherLiderFora(st, best.id); return true; }
      if (pd.tipo === 'pagarItens') { E.pagarItens(st, decidirPagamento(st)); return true; }
      if (pd.tipo === 'negociador') { E.resolverNegociador(st, decidirNegociador(st)); return true; }
      if (pd.tipo === 'pegarItens') { E.pegarItem(st, pd.itens.slice().sort((a, b) => valorItem(b) - valorItem(a))[0]); return true; }
      if (pd.tipo === 'desempate') { const eu = st.vez; E.escolherDesempate(st, pd.opcoes.includes(eu) ? eu : pd.opcoes.slice().sort((a, b) => E.nInsignias(E.J(st, a)) - E.nInsignias(E.J(st, b)))[0]); return true; }
      if (pd.tipo === 'descartarDe') { E.descartarDe(st, pd.itens.slice().sort((a, b) => valorItem(a) - valorItem(b))[0]); return true; }
      if (pd.tipo === 'descartar') { E.descartarExcesso(st, p.itens.slice().sort((a, b) => valorItem(a) - valorItem(b)).slice(0, pd.n)); return true; }
      E.fecharPend(st); return true;
    }
    if (st.fila && st.fila.length) return false;
    if (st.fase === 'inicio') {
      const u = liderUtil(st, p, p.pos);
      if (u && !st.turno.batalhouLider && u.pl.p >= 0.5) { E.abrirLider(st); return true; }
      // Trem para uma cidade já visitada com líder vencível
      const g = E.grafo(st), noCidade = g.nodes[p.pos].kind === 'cidade' || g.nodes[p.pos].especial === 'planalto';
      if (noCidade) { const alvo = p.passou.filter(k => k !== p.pos && g.nodes[k].kind === 'cidade').map(k => ({ k, u: liderUtil(st, p, k) })).filter(x => x.u && x.u.pl.p >= 0.67).sort((a, b) => b.u.pl.p - a.u.pl.p)[0]; if (alvo) { E.trem(st, alvo.k); return true; } }
      const t = p.treinador && E.idx().tr[p.treinador];
      if (t && t.efeito === 'lyra' && p.itens.length <= 1 && Math.random() < 0.25) { E.lyra(st); return true; }
      const doce = p.itens.find(i => i.startsWith('doceraro#'));
      if (doce && !st.turno.doceTentado) { st.turno.doceTentado = true; const antes = p.itens.length; E.usarItem(st, doce); if (p.itens.length < antes) return true; }
      const truque = p.itens.find(i => i.startsWith('truquerocket#'));
      if (truque && st.jogadores.some(q => q.id !== p.id && q.itens.length >= 2 && !E.temBoneca(q))) { E.usarItem(st, truque); return true; }
      const mel = p.itens.find(i => i.startsWith('potedemel#'));
      if (mel && !st.turno.melTentado) { st.turno.melTentado = true; const ok = E.filtrarSlots(st, { hex: true, aberta: true }).some(k => pCaptura(st, p, st.slots[k].carta, null, k) * valorSlot(st, p, k) >= 3); if (ok) { E.usarItem(st, mel); return true; } }
      const nav = p.itens.find(i => i.startsWith('pokenavplus#'));
      if (nav && !st.turno.navUsado) { const fraco = valorTreinador(p, p.treinador) < 2.5; const forte = st.jogadores.some(q => q.id !== p.id && valorTreinador(q, q.treinador) >= 5 && !E.temBoneca(q)); if (fraco || forte) { st.turno.navUsado = true; E.usarItem(st, nav); return true; } }
      E.rolarMovimento(st); return true;
    }
    if (st.fase === 'mover') {
      const t = st.turno;
      if (t.rolagem == null && t.dados && t.dados.length > 1) { // Green: escolhe o dado com o melhor destino
        let best = t.dados[0], bv = -1e9;
        t.dados.forEach(d => { const ds = E.destinos(st, st.vez, d); Object.entries(ds).forEach(([k, info]) => { const v = pontuarDestino(st, p, k, info); if (v > bv) { bv = v; best = d; } }); });
        E.escolherDado(st, best); return true;
      }
      const ds = t.destinos || {}; const ks = Object.keys(ds);
      if (E.celebiDe(p) && !t.celebi && t.dados && t.dados.length === 1 && !t.encrenca) { const best = ks.length ? Math.max(...ks.map(k => pontuarDestino(st, p, k, ds[k]))) : -99; if (best < 6) { E.celebiMovimento(st, 0); return true; } }
      if (!ks.length) { st.fase = 'acao'; return true; }
      const alvo = ks.map(k => ({ k, v: pontuarDestino(st, p, k, ds[k]) })).sort((a, b) => b.v - a.v)[0].k;
      const info = ds[alvo]; E.mover(st, alvo, info.custo ? p.itens.slice().sort((a, b) => valorItem(a) - valorItem(b)).slice(0, info.custo) : []); return true;
    }
    if (st.fase === 'acao') {
      const u = liderUtil(st, p, p.pos);
      if (u && !st.turno.batalhouLider && (u.pl.p >= 0.34 || !st.turno.moveu)) { E.abrirLider(st); return true; }
      if (E.podeEncerrar(st)) { E.encerrarTurno(st); return true; }
    }
    return false;
  }
  G.AI = { decidirRepel, decidirCynthia, reacaoLiga, aplicarReacaoLiga, duplaPraca, premioPraca, escolhaLiga, oponenteLiga, decidirReacao, decidirFestival, decidirJuniper, decidirTreinador: st => { const q = E.J(st, st.pend.jogador); return [q.treinador, ...q.treinadoresExtra].filter(Boolean).sort((a, b) => valorTreinador(q, b) - valorTreinador(q, a))[0]; }, decidirBriney, passo, pCaptura, planoLider, pVitoria, decidirBoneca, escolhaDuelo };
})(window);
