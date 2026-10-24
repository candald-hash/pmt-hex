// Motor de regras do Pokémon Master Trainer: HEX — lógica pura, sem DOM.
// O estado é um objeto JSON simples (serializável), para salvar/carregar e, mais tarde, sincronizar online.
(function (G) {
  'use strict';
  const D = () => G.DATA;
  const CORES = ['inicial', 'rosa', 'verde', 'azul', 'vermelho', 'amarelo'];
  const ORDEM_FORCA = { rosa: 1, verde: 2, azul: 3, vermelho: 4, amarelo: 5, inicial: 0 };
  const TIPOS_NOME = { normal: 'Normal', fogo: 'Fogo', agua: 'Água', grama: 'Grama', eletrico: 'Elétrico', gelo: 'Gelo', lutador: 'Lutador', veneno: 'Veneno', terra: 'Terra', voador: 'Voador', psiquico: 'Psíquico', inseto: 'Inseto', pedra: 'Pedra', fantasma: 'Fantasma', dragao: 'Dragão', sombrio: 'Noturno', metal: 'Metal', fada: 'Fada' };
  const CORES_PEAO = ['branco', 'preto', 'vermelho', 'azul', 'verde', 'amarelo'];
  const OPOSTO = { L: 'O', O: 'L', NE: 'SO', SO: 'NE', NO: 'SE', SE: 'NO' };
  const HW = 1113, HH = 1371; // tamanho de referência de cada hexágono

  // ---------- aleatoriedade com semente (mulberry32) ----------
  function rnd(st) { let t = (st.rng = (st.rng + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function dado(st) { return 1 + Math.floor(rnd(st) * 6); }
  function embaralhar(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- índices ----------
  let IDX = null;
  function idx() {
    if (IDX) return IDX;
    const d = D(); IDX = { poke: {}, ev: {}, sev: {}, tr: {}, ld: {}, it: {}, ldNome: {} };
    d.pokemon.forEach(c => IDX.poke[c.id] = c); d.eventos.forEach(c => IDX.ev[c.id] = c); d.supereventos.forEach(c => IDX.sev[c.id] = c);
    d.treinadores.forEach(c => IDX.tr[c.id] = c); d.lideres.forEach(c => { IDX.ld[c.id] = c; IDX.ldNome[norm(c.nome)] = c; }); d.itens.forEach(c => IDX.it[c.id] = c);
    return IDX;
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
  const P = id => idx().poke[id];
  const ITEM_OCULTO = { id: 'oculto', nome: 'Item', texto: '', uso: null };
  const ITEM = inst => idx().it[String(inst).split('#')[0]] || Object.assign({ img: D().versos.item }, ITEM_OCULTO);

  // ---------- montagem do tabuleiro ----------
  // posições: linha de baixo b0..b3, linha de cima t0..t3 (deslocada meia largura para a direita)
  const POS = { b0: [0, 1], b1: [1, 1], b2: [2, 1], b3: [3, 1], t0: [0, 0], t1: [1, 0], t2: [2, 0], t3: [3, 0] };
  function posXY(p) { const [c, r] = POS[p]; return { x: c * HW + (r === 0 ? HW / 2 : 0), y: r === 0 ? 0 : HH * 0.75 }; }
  function vizinho(p, lado) {
    const [c, r] = POS[p]; let nc = c, nr = r;
    if (lado === 'L') nc = c + 1; else if (lado === 'O') nc = c - 1;
    else if (r === 1) { if (lado === 'NE') { nr = 0; } else if (lado === 'NO') { nr = 0; nc = c - 1; } else return null; }
    else { if (lado === 'SE') { nr = 1; nc = c + 1; } else if (lado === 'SO') { nr = 1; } else return null; }
    const k = Object.keys(POS).find(k => POS[k][0] === nc && POS[k][1] === nr); return k || null;
  }

  function montarTabuleiro(st) {
    const H = D().hexes, por = { t1: [], t2: [], t3: [] };
    Object.values(H).forEach(h => { if (por[h.tier]) por[h.tier].push(h.id); });
    const t1 = embaralhar(st, por.t1).slice(0, 2), t2 = embaralhar(st, por.t2).slice(0, 2), t3 = embaralhar(st, por.t3).slice(0, 2);
    const ini = Object.values(H).find(h => h.tier === 'inicio').id, fim = Object.values(H).find(h => h.tier === 'fim').id;
    const lay = { b0: ini, b1: t1[0], t0: t1[1], b2: t2[0], t1: t2[1], b3: t3[0], t2: t3[1], t3: fim };
    st.layout = lay;
  }

  // grafo global (derivado do layout; não precisa ser salvo)
  const GRAFO = new WeakMap();
  function grafo(st) {
    if (GRAFO.has(st) && GRAFO.get(st).lay === st.layout) return GRAFO.get(st);
    const H = D().hexes, nodes = {}, adj = {};
    const add = (a, b, cost) => { (adj[a] = adj[a] || []).push({ to: b, cost: cost || 0 }); };
    for (const [pos, hid] of Object.entries(st.layout)) {
      const h = H[hid], o = posXY(pos);
      h.spaces.forEach(s => { const k = pos + ':' + s.id; nodes[k] = Object.assign({ key: k, pos, hex: hid, wx: o.x + s.x * HW, wy: o.y + s.y * HH }, s); adj[k] = adj[k] || []; });
      h.edges.forEach(e => { const a = pos + ':' + e.a, b = pos + ':' + e.b; add(a, b, e.itemCost); if (e.dir === 'both') add(b, a, 0); });
    }
    // emenda das saídas entre hexágonos vizinhos
    for (const [pos, hid] of Object.entries(st.layout)) {
      H[hid].spaces.filter(s => s.kind === 'porta').forEach(s => {
        const lado = s.lado; const vp = vizinho(pos, lado); if (!vp || !st.layout[vp]) return;
        const outro = H[st.layout[vp]].spaces.find(x => x.kind === 'porta' && x.lado === OPOSTO[lado]);
        if (outro) add(pos + ':' + s.id, vp + ':' + outro.id, 0);
      });
    }
    const slots = {};
    for (const [pos, hid] of Object.entries(st.layout)) {
      const o = posXY(pos);
      H[hid].slots.forEach(c => { slots[pos + ':' + c.id] = { key: pos + ':' + c.id, pos, cor: c.color, espaco: c.space ? pos + ':' + c.space : null, wx: o.x + c.x * HW, wy: o.y + c.y * HH }; });
    }
    const loopE2 = Object.values(nodes).filter(n => n.pos === 't3' && n.kind !== 'porta' && n.especial !== 'planalto').map(n => n.key);
    const g = { lay: st.layout, nodes, adj, slots, loopE2 };
    GRAFO.set(st, g); return g;
  }

  // ---------- novo jogo ----------
  function novoJogo(cfg) {
    // cfg: { jogadores: [{nome, cor}], seed }
    const st = { v: 1, rng: (cfg.seed || Date.now()) | 0, jogadores: [], log: [], vez: 0, rodada: 1, fase: 'inicio', pend: null, fila: [], decks: {}, descartes: { item: [], evento: [], superevento: [], treinador: [] }, slots: {}, pioneiros: {}, lideres: {}, lideresFora: [], liga: null, vencedor: null };
    montarTabuleiro(st);
    const g = grafo(st), d = D();
    // baralhos de Pokémon por cor
    st.elenco = cfg.elenco && d.elencos && d.elencos[cfg.elenco] ? cfg.elenco : 'padrao';
    CORES.forEach(c => st.decks[c] = embaralhar(st, d.pokemon.filter(p => p.cor === c && (p.elencos || ['padrao']).includes(st.elenco)).map(p => p.id)));
    st.decks.item = embaralhar(st, d.itens.flatMap(c => Array.from({ length: c.copias || 1 }, (_, i) => c.id + '#' + i)));
    st.decks.evento = embaralhar(st, d.eventos.map(c => c.id));
    st.decks.superevento = embaralhar(st, d.supereventos.map(c => c.id));
    st.decks.treinador = embaralhar(st, d.treinadores.map(c => c.id));
    // cartas viradas para baixo em cada espaço de carta
    Object.values(g.slots).forEach(s => { st.slots[s.key] = { carta: tirar(st, s.cor), aberta: false, fraco: false }; });
    // líderes de cada cidade em jogo
    const usados = new Set();
    Object.values(g.nodes).filter(n => n.kind === 'cidade' && n.cidade && n.cidade.lider).forEach(n => {
      const L = idx().ldNome[norm(n.cidade.lider)] || Object.values(idx().ld).find(l => norm(l.nome).startsWith(norm(n.cidade.lider).slice(0, 4)));
      if (L) { st.lideres[n.key] = L.id; usados.add(L.id); }
    });
    st.lideresFora = d.lideres.filter(l => !usados.has(l.id)).map(l => l.id);
    const inicio = Object.values(g.nodes).find(n => n.pos === 'b0' && n.kind === 'cidade').key;
    cfg.jogadores.forEach((j, i) => {
      st.jogadores.push({ id: i, nome: j.nome || ('Jogador ' + (i + 1)), cor: j.cor || CORES_PEAO[i], avatar: j.avatar || null, ia: !!j.ia, pos: inicio, pokemon: [], itens: [], treinador: null, treinadoresExtra: [], insignias: [null, null, null, null, null, null], lideresVencidos: [], passou: [inicio], visitou: [inicio], pular: 0, travadas: [], mais1: {}, planalto: false, e2: [], capturas: 0 });
    });
    st.jogadores.forEach(p => { p.pokemon.push(tirar(st, 'inicial')); comprarItem(st, p, 1, true); p.treinador = st.decks.treinador.shift(); });
    log(st, `Partida criada. Tabuleiro: ${Object.values(st.layout).join(', ')}.`);
    inicioTurno(st);
    return st;
  }
  function tirar(st, cor) { const dk = st.decks[cor]; return dk && dk.length ? dk.shift() : null; }
  function devolver(st, cor, id) { if (id) st.decks[cor].push(id); }
  // eliminado da Liga: Pokémons voltam às pilhas da sua cor (fora do jogo); Itens e Treinadores vão para o descarte
  function devolverEliminado(st, q) {
    const np = q.pokemon.length, ni = q.itens.length;
    q.pokemon.forEach(id => { const cor = P(id).cor; if (st.decks[cor]) devolver(st, cor, id); }); q.pokemon = []; q.mais1 = {}; q.travadas = [];
    q.itens.forEach(i => st.descartes.item.push(i)); q.itens = [];
    [q.treinador, ...q.treinadoresExtra].filter(Boolean).forEach(t => st.descartes.treinador.push(t)); q.treinador = null; q.treinadoresExtra = [];
    st.propostas = (st.propostas || []).filter(pr => pr.de !== q.id && pr.para !== q.id);
    log(st, `${q.nome} devolve ${np} Pokémon${np === 1 ? '' : 's'} às pilhas e descarta ${ni} Ite${ni === 1 ? 'm' : 'ns'} e seu Treinador.`);
  }
  function log(st, msg, tipo, refs) { const e = { t: st.rodada, msg, tipo: tipo || '' }; if (refs && refs.length) e.refs = refs; st.log.push(e); if (st.log.length > 400) st.log.shift(); }
  const atv = st => (st.ator != null ? st.ator : st.vez); // quem executa o efeito agora (ator ≠ vez quando um efeito é copiado)
  const J = (st, i) => st.jogadores[i == null ? atv(st) : i];

  // ---------- regras derivadas ----------
  function obedece(p, cor) {
    if (cor === 'inicial' || cor === 'rosa' || cor === 'verde') return true;
    if (cor === 'azul') return !!p.insignias[0];
    if (cor === 'vermelho') return !!p.insignias[1];
    if (cor === 'amarelo') return !!p.insignias[3];
    return false;
  }
  function nInsignias(p) { return p.insignias.filter(Boolean).length; }
  function limiteItens(p) { const t = p.treinador && idx().tr[p.treinador]; if (t && t.efeito === 'backpacker') return 8; if (t && t.efeito === 'alder') return 3; return 6; }
  function temTipo(p, tipo) { return p.pokemon.some(id => P(id).tipos.includes(tipo)); }
  function temCor(p, cor) { return p.pokemon.some(id => P(id).cor === cor); }

  // bônus de evolução: grupo de dois (+2) ou três (+4) para o mais evoluído; famílias ramificadas valem no máximo +2
  function bonusEvolucao(p, id, cores) {
    const c = P(id); if (!c.familia) return 0;
    const fam = p.pokemon.map(P).filter(x => x.familia === c.familia && (!cores || cores.includes(x.cor)));
    if (c.familiaRamificada) return (c.estagio > 0 && fam.some(x => x.estagio < c.estagio)) ? 2 : 0;
    const est = new Set(fam.map(x => x.estagio)); const max = Math.max(...est);
    if (c.estagio !== max) return 0;
    return est.size >= 3 ? 4 : est.size === 2 ? 2 : 0;
  }
  function maisEvoluido(p, fam) { const l = p.pokemon.map(P).filter(x => x.familia === fam); if (!l.length) return null; return l.reduce((a, b) => b.estagio > a.estagio ? b : a).id; }
  function bonusTravada(p, id) { const c = P(id); let b = p.mais1[id] || 0; if (c.familia && p.travadas.includes(c.familia) && maisEvoluido(p, c.familia) === id) b += 1; return b; }
  function bonusTreinador(p, id) {
    const t = p.treinador && idx().tr[p.treinador]; if (!t) return 0; const c = P(id);
    if (t.especialista && c.tipos.some(x => t.especialista.includes(x))) return 1;
    if (t.efeito === 'alder') return 1;
    if (t.efeito === 'ethan' && c.cor === 'azul') return 1;
    if (t.efeito === 'may' && c.cor === 'verde') return 2;
    return 0;
  }
  function forcaBase(p, id) { return P(id).forca + bonusEvolucao(p, id) + bonusTravada(p, id); }
  function vantagem(atacanteVant, defensorTipos) { return defensorTipos.filter(t => atacanteVant.includes(t)).length * 2; }
  function bonusItemBatalha(inst, id) { const it = ITEM(inst); if (!it || it.uso !== 'batalha' || !it.bonus) return 0; if (it.tipos && !P(id).tipos.some(t => it.tipos.includes(t))) return 0; return it.bonus; }
  function moverMais1(de, para, id) { if (de.mais1 && de.mais1[id]) { para.mais1 = para.mais1 || {}; para.mais1[id] = (para.mais1[id] || 0) + de.mais1[id]; delete de.mais1[id]; } }
  function familiaTravada(p, id) { const c = P(id); return c.familia && p.travadas.includes(c.familia); }

  // ---------- movimento ----------
  function destinos(st, pi, n, opts) {
    opts = opts || {}; const g = grafo(st), p = J(st, pi), out = {};
    const lim = opts.ate ? 1 : n; // Hiker: qualquer valor de 1 a n
    const ok = (k) => {
      const s = g.nodes[k]; if (!s) return false;
      if (s.kind === 'passagem' && s.tipo && !temTipo(p, s.tipo)) return false;
      if (s.especial === 'planalto' && nInsignias(p) < 6 && !(st.liga && st.liga.ativos.includes(p.id))) return false;
      return true;
    };
    const parada = (k) => { const s = g.nodes[k]; return s.kind === 'cidade' || s.especial === 'planalto'; };
    (function dfs(k, passos, vis, cam) {
      for (const { to, cost } of (g.adj[k] || [])) {
        if (vis.has(to) || !ok(to)) continue;
        const s = g.nodes[to], porta = s.kind === 'porta' || s.kind === 'passagem', np = passos + (porta ? 0 : 1);
        if (np > n) continue;
        const camN = cam.concat(to);
        if (!porta) {
          if (cost > 0) { if (p.itens.length >= cost && !out[to]) out[to] = { custo: cost, caminho: camN }; continue; }
          if (np === n || (opts.ate && np >= lim)) out[to] = out[to] || { caminho: camN };
          else if (parada(to)) out[to] = out[to] || { caminho: camN, cedo: true };
          if (s.especial === 'planalto' && !p.planalto) continue; // primeira chegada ao Planalto encerra o movimento
        }
        if (np < n) { vis.add(to); dfs(to, np, vis, camN); vis.delete(to); }
      }
    })(p.pos, 0, new Set([p.pos]), []);
    delete out[p.pos];
    return out;
  }

  // ---------- turno ----------
  function inicioTurno(st, extra) {
    st.efeitos = st.efeitos || [];
    if (!extra) tickEfeitos(st);
    const p = J(st);
    if (st.repelPausa && st.repelPausa[p.id]) delete st.repelPausa[p.id];
    st.fase = 'inicio'; st.turno = { rolagem: null, dados: null, destinos: null, batalhouLider: false, moveu: false, bicicleta: st.turno && st.turno.bicicletaUsada ? true : false };
    if (p.pular > 0) { p.pular--; log(st, `${p.nome} perde a vez.`); proximo(st); return; }
    log(st, `Vez de ${p.nome}.`, 'vez');
    if (!extra && preso(st, p.id)) return punirPreso(st, p);
    const L = st.liga;
    if (!extra && L && L.etapa === 'final' && L.finalTurnos && !L.finalMarcada && Object.values(L.finalTurnos).every(n => n <= 0)) {
      L.finalMarcada = true; const [f1, f2] = L.ativos; log(st, `Os finalistas jogaram seus 3 turnos: começa a FINAL da Liga, ${J(st, f1).nome} × ${J(st, f2).nome}!`, 'destaque');
      L.fila.push([f1, f2, 'final']); ligaProxima(st);
    }
    abrirProposta(st);
  }
  // ---------- jogador preso (ex.: Voar/Túnel para um espaço cercado por passagens de tipo) ----------
  function noHexFinal(st, q) { const g = grafo(st), pl = Object.values(g.nodes).find(n => n.especial === 'planalto'); return !!pl && g.nodes[q.pos] && g.nodes[q.pos].pos === pl.pos; }
  function preso(st, pi) {
    const g = grafo(st), q = J(st, pi), s = g.nodes[q.pos]; if (!s || s.kind === 'cidade' || s.especial === 'planalto' || st.liga) return false;
    if (q.itens.some(i => i.split('#')[0] === 'voar')) return false; // ainda pode Voar
    const max = q.itens.some(i => ['corda', 'escaperope'].includes(i.split('#')[0])) ? 8 : 6;
    for (let n = 1; n <= max; n++) if (Object.keys(destinos(st, pi, n)).length) return false;
    return true;
  }
  function punirPreso(st, p) {
    const g = grafo(st), hex = g.nodes[p.pos].pos, c = Object.values(g.nodes).find(n => n.pos === hex && n.kind === 'cidade'), onde = nomeEspaco(st, p.pos);
    if (c) { p.pos = c.key; addU(p.passou, c.key); }
    let it = null; if (p.itens.length) { it = p.itens[Math.floor(rnd(st) * p.itens.length)]; descartarItem(st, p, it); }
    const txt = `${p.nome} ficou preso em ${onde} (sem Pokémon para atravessar as passagens): volta para ${c ? nomeEspaco(st, c.key) : 'a cidade'}${it ? ', descarta ' + ITEM(it).nome : ''} e perde este turno.`;
    log(st, txt, 'destaque');
    st.pend = { tipo: 'preso', jogador: p.id, item: it, titulo: 'Você ficou preso!', texto: txt };
  }
  function confirmarPreso(st) { const pd = st.pend; if (!pd || pd.tipo !== 'preso') return; st.pend = null; proximo(st); }
  function proximo(st) {
    const L = st.liga;
    if (L && L.etapa === 'final' && L.finalTurnos && L.finalTurnos[st.vez] > 0) { L.finalTurnos[st.vez]--; log(st, `Final da Liga: ${J(st, st.vez).nome} tem mais ${L.finalTurnos[st.vez]} turno(s) antes da final.`); }
    const vivos = st.jogadores.some(q => !q.eliminado);
    do { st.vez = (st.vez + 1) % st.jogadores.length; if (st.vez === 0) st.rodada++; } while (vivos && st.jogadores[st.vez].eliminado);
    st.turno = null; inicioTurno(st);
  }

  function rolarMovimento(st, opts) {
    const p = J(st); if (st.fase !== 'inicio') return;
    const t = p.treinador && idx().tr[p.treinador];
    let d1 = dado(st), d2 = null;
    if (t && t.efeito === 'green') d2 = dado(st);
    silver(st, p, [d1, d2]);
    st.turno.dados = d2 ? [d1, d2] : [d1];
    st.turno.rolagem = d2 ? null : d1;
    st.fase = 'mover';
    log(st, `${p.nome} rolou ${d2 ? d1 + ' e ' + d2 + ' (Green: escolha um)' : d1}.`);
    if (encrencado(st, p)) { st.turno.rolagem = 1; st.turno.encrenca = true; log(st, 'Encrenca em Dobro: só pode andar 1 espaço.'); return calcDestinos(st); }
    if (!d2) aposRolagem(st);
  }
  function escolherDado(st, v) { if (st.fase !== 'mover') return; st.turno.rolagem = v; aposRolagem(st); }
  function aposRolagem(st) {
    const p = J(st), e = (st.efeitos || []).find(x => x.tipo === 'briney');
    if (e) { const g = grafo(st), dono = J(st, e.dono); if (g.nodes[dono.pos].pos === g.nodes[p.pos].pos && !st.turno.brineyFeito) { st.turno.brineyFeito = true; st.pend = { tipo: 'briney', dono: e.dono, valor: st.turno.rolagem, titulo: `Barco de Briney: ${dono.nome} pode somar ou subtrair 1 do dado de ${p.nome} (${st.turno.rolagem})` }; return; } }
    calcDestinos(st);
  }
  function resolverBriney(st, delta) {
    const pd = st.pend; if (!pd || pd.tipo !== 'briney' || ![-1, 0, 1].includes(delta)) return;
    st.turno.rolagem = Math.max(1, pd.valor + delta); st.pend = null;
    if (delta) log(st, `${J(st, pd.dono).nome} (Barco de Briney) ajustou o dado para ${st.turno.rolagem}.`);
    calcDestinos(st);
  }
  function hiker(st) { const p = J(st); if (st.fase !== 'inicio' || encrencado(st, p)) return; st.fase = 'mover'; st.turno.rolagem = 2; st.turno.hiker = true; st.turno.destinos = destinos(st, st.vez, 2, { ate: true }); log(st, `${p.nome} usa Hiker: anda até 2 espaços.`); }
  function ajustarRolagem(st, delta, inst) {
    // Corda de Fuga
    const p = J(st); if (st.fase !== 'mover' || st.turno.rolagem == null || st.turno.encrenca) return;
    const v = Math.max(1, st.turno.rolagem + delta); st.turno.rolagem = v; descartarItem(st, p, inst); calcDestinos(st);
    log(st, `${p.nome} usou ${ITEM(inst).nome}: movimento agora é ${v}.`, '', [['it', inst.split('#')[0]]]);
  }
  function calcDestinos(st) { st.turno.destinos = destinos(st, st.vez, st.turno.rolagem); if (!Object.keys(st.turno.destinos).length) log(st, 'Nenhum destino possível com esse valor.'); }
  function silver(st, p, ds) { const t = p.treinador && idx().tr[p.treinador]; if (t && t.efeito === 'silver') ds.filter(x => x === 1).forEach(() => { comprarItem(st, p, 1); log(st, `Silver: ${p.nome} tirou 1 e compra um Item.`); }); }

  function mover(st, destino, pagar) {
    const p = J(st), info = st.turno && st.turno.destinos && st.turno.destinos[destino]; if (!info) return;
    const g = grafo(st);
    if (info.custo) { (pagar || []).slice(0, info.custo).forEach(inst => descartarItem(st, p, inst)); log(st, `${p.nome} descarta ${info.custo} Item(ns) para passar.`); }
    info.caminho.forEach(k => { const s = g.nodes[k]; if (s.kind === 'cidade' || s.especial === 'planalto') addU(p.passou, k); if (s.pos === 't3' && g.loopE2.includes(k)) addU(p.e2, k); });
    st.mov = { j: p.id, cam: [p.pos].concat(info.caminho), seq: ((st.mov && st.mov.seq) || 0) + 1 }; // para a animação do peão
    p.pos = destino; st.turno.destinos = null; st.turno.moveu = true; st.fase = 'acao';
    log(st, `${p.nome} foi para ${nomeEspaco(st, destino)}.`);
    chegar(st, destino);
  }
  function addU(a, v) { if (!a.includes(v)) a.push(v); }
  function trem(st, cidade) {
    const p = J(st); if (st.fase !== 'inicio' || !p.passou.includes(cidade) || cidade === p.pos) return;
    st.mov = { j: p.id, cam: [p.pos, cidade], seq: ((st.mov && st.mov.seq) || 0) + 1, trem: true };
    p.pos = cidade; st.fase = 'acao'; st.turno.moveu = true; log(st, `${p.nome} pegou o Trem para ${nomeEspaco(st, cidade)}.`);
    chegar(st, cidade, { trem: true });
  }
  function nomeEspaco(st, k) {
    const s = grafo(st).nodes[k]; if (!s) return k;
    if (s.kind === 'cidade') return s.cidade && s.cidade.nome || 'Cidade';
    return { pokebola: 'Poké-Bola', evento: 'Evento', superevento: 'Super Evento', passagem: 'Passagem', especial: ({ planalto: 'Planalto Índigo', comecar_liga: 'Começar a Liga' })[s.especial] || 'Espaço especial' }[s.kind] || s.kind;
  }

  // ao parar num espaço
  function chegar(st, k, o) {
    o = o || {}; const g = grafo(st), s = g.nodes[k], p = J(st);
    if (s.kind === 'pokebola') {
      const slot = Object.values(g.slots).find(x => x.espaco === k);
      if (slot && st.slots[slot.key].carta) { const nova = revelar(st, slot.key); iniciarCaptura(st, { slot: slot.key }); if (nova) janelaRepel(st, [slot.key]); }
      else log(st, 'Não há Pokémon neste espaço.');
    } else if (s.kind === 'evento') comprarEvento(st, 'evento');
    else if (s.kind === 'superevento') comprarEvento(st, 'superevento');
    else if (s.kind === 'cidade') chegarCidade(st, k, o);
    else if (s.kind === 'especial') especial(st, s, k);
  }
  function chegarCidade(st, k, o) {
    const g = grafo(st), s = g.nodes[k], p = J(st), c = s.cidade || {};
    const passos = [];
    if (!o.trem) {
      if (st.pioneiros[k] == null && c.pioneiro) { st.pioneiros[k] = p.id; log(st, `${p.nome} é o Pioneiro de ${c.nome}! ${c.pioneiro}`, 'destaque'); passos.push(...(c.pioneiroAuto || autoTexto(c.pioneiro))); }
      else if (st.pioneiros[k] == null) st.pioneiros[k] = p.id;
      if (!p.visitou.includes(k)) { p.visitou.push(k); if (c.primeiraVisita) { log(st, `Primeira visita a ${c.nome}: ${c.primeiraVisita}`); passos.push(...(c.primeiraAuto || autoTexto(c.primeiraVisita))); } }
    }
    addU(p.passou, k);
    executar(st, passos);
  }
  // efeitos simples de cidade, a partir do texto da casa
  function autoTexto(t) {
    const n = norm(t), num = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, '3': 3, '2': 2, '4': 4 };
    const out = [];
    let m;
    if ((m = t.match(/^Compre (uma|duas|3) Cartas? Item\.$/i))) out.push(['itens', { uma: 1, duas: 2, '3': 3 }[m[1].toLowerCase()]]);
    else if ((m = t.match(/^Compre (\d) Cartas Item e (\d) Cartas de Treinador\.$/i))) out.push(['itens', +m[1]], ['treinador', +m[2]]);
    else if (/^Compre duas Cartas de Treinador e duas Cartas Item\.$/i.test(t)) out.push(['treinador', 2], ['itens', 2]);
    else if (/^Compre uma Carta de Treinador\.$/i.test(t)) out.push(['treinador', 1]);
    else if (/^Compre uma Carta Evento\.$/i.test(t)) out.push(['evento']);
    else if (/^Compre um Super Evento\.$/i.test(t)) out.push(['superevento']);
    else if ((m = t.match(/^Ganhe um Pokémon (Azul|Verde|Vermelho|Rosa) aleatório\.$/i))) out.push(['ganhar', norm(m[1]), 1]);
    else if ((m = t.match(/^Tente capturar um Pokémon (Amarelo|Vermelho|Azul) aleatório\.$/i))) out.push(['capturar', norm(m[1])]);
    return out;
  }
  function especial(st, s, k) {
    const p = J(st), e = s.especial;
    const m = { compre_2_vermelhos: ['vermelho', 2], compre_3_azuis: ['azul', 3], compre_4_verdes: ['verde', 4] }[e];
    if (m) {
      const escala = ['rosa', 'verde', 'azul', 'vermelho'], cartas = [], usadas = new Set();
      for (let i = 0; i < m[1]; i++) { let c = null; for (let j = escala.indexOf(m[0]); j >= 0 && !c; j--) { c = tirar(st, escala[j]); if (c && escala[j] !== m[0]) usadas.add(escala[j]); } if (c) cartas.push(c); }
      if (!cartas.length) { log(st, `Não há Pokémons ${m[0]}s (nem mais fracos) nas pilhas.`); return; }
      if (usadas.size) log(st, `A pilha ${m[0]} acabou: completando com Pokémons ${[...usadas].join(', ')} (mais fracos).`);
      st.pend = { tipo: 'escolherCaptura', cartas, cor: m[0], titulo: `Compre os ${m[1]} próximos Pokémons ${m[0]}s e tente capturar um` }; return; }
    if (e === 'compre_2_eventos') { const a = []; for (let i = 0; i < 2; i++) { reporBaralho(st, 'evento'); const c = st.decks.evento.shift(); if (c) a.push(c); } est(p).eventos += a.length; if (!a.length) return; st.pend = { tipo: 'escolherEvento', cartas: a, titulo: 'Compre 2 Cartas Evento e escolha uma para ativar' }; return; }
    if (e === 'planalto') {
      if (!p.planalto) { p.planalto = true; if (st.pioneiroPlanalto == null) st.pioneiroPlanalto = p.id; log(st, `${p.nome} chegou ao Planalto Índigo!`, 'destaque'); if (p.pokemon.length) st.pend = { tipo: 'travar', titulo: 'Chegada ao Planalto: trave e melhore (+1) uma família de Pokémon' }; }
      addU(p.passou, k); return;
    }
    if (e === 'comecar_liga') {
      if (st.liga) { ligaGatilho(st, p.id); return; }
      const g = grafo(st); const volta = g.loopE2.every(x => p.e2.includes(x));
      if (!volta) { log(st, `${p.nome} ainda não deu uma volta completa: compra uma Carta Item.`); comprarItem(st, p, 1); return; }
      log(st, `${p.nome} parou em "Começar a Liga"! A Liga Pokémon começa.`, 'destaque');
      iniciarLiga(st, p.id); return;
    }
  }

  // ---------- cartas ----------
  function reporBaralho(st, nome) {
    if (st.decks[nome].length) return;
    if (st.descartes[nome] && st.descartes[nome].length) { st.decks[nome] = embaralhar(st, st.descartes[nome]); st.descartes[nome] = []; log(st, `Baralho de ${nome} reembaralhado.`); }
  }
  function comprarItem(st, p, n, silencioso) {
    const got = [];
    for (let i = 0; i < n; i++) { reporBaralho(st, 'item'); const c = st.decks.item.shift(); if (c) { p.itens.push(c); got.push(c); } }
    if (!silencioso && got.length) log(st, `${p.nome} comprou ${got.length} Item(ns).`);
    return got;
  }
  // Wally: antes de comprar Itens (Eventos e vitórias em batalha), pode descartar 1 Item da mão para comprar 1 a mais
  const wallyOk = p => !!(p.treinador && idx().tr[p.treinador] && idx().tr[p.treinador].efeito === 'wally' && p.itens.length);
  function ganharItens(st, p, n) {
    if (n > 0 && wallyOk(p)) { st.fila = [['comoJogador', p.id, [['wallyCompra', n]]]].concat(st.fila || []); return; }
    comprarItem(st, p, n);
  }
  function resolverWally(st, inst) {
    const pd = st.pend; if (!pd || pd.tipo !== 'wally') return; const p = J(st);
    if (inst && p.itens.includes(inst)) { descartarItem(st, p, inst); log(st, `Wally: ${p.nome} descartou ${ITEM(inst).nome} para comprar 1 Item a mais.`, '', [['tr', p.treinador], ['it', inst.split('#')[0]]]); comprarItem(st, p, pd.n + 1); }
    else comprarItem(st, p, pd.n);
    st.pend = null; continuar(st);
  }
  function descartarItem(st, p, inst) { const i = p.itens.indexOf(inst); if (i < 0) return; p.itens.splice(i, 1); st.descartes.item.push(inst); }
  function comprarTreinador(st, p, n) {
    for (let i = 0; i < n; i++) { reporBaralho(st, 'treinador'); const c = st.decks.treinador.shift(); if (c) p.treinadoresExtra.push(c); }
    if (p.treinadoresExtra.length) { st.pend = { tipo: 'treinador', jogador: p.id, titulo: 'Escolha seu Treinador ativo' }; return true; }
  }
  function escolherTreinador(st, id) {
    const pd = st.pend; const p = J(st, pd.jogador); const todos = [p.treinador, ...p.treinadoresExtra].filter(Boolean);
    todos.filter(x => x !== id).forEach(x => st.descartes.treinador.push(x)); p.treinador = id; p.treinadoresExtra = [];
    log(st, `${p.nome} fica com o Treinador ${idx().tr[id].nome}.`, '', [['tr', id]]); st.pend = null; continuar(st);
  }
  function ganharPokemon(st, p, id, origem) {
    p.pokemon.push(id); p.capturas++;
    if (st.ganhosCarta) st.ganhosCarta.push([p.id, id]);
    (st.efeitos || []).filter(e => e.tipo === 'parque').forEach(e => (e.ganhos[p.id] = e.ganhos[p.id] || []).push(id));
    log(st, `${p.nome} ganhou ${P(id).nome}${origem ? ' (' + origem + ')' : ''}.`, 'destaque', [['pk', id]]);
    const t = p.treinador && idx().tr[p.treinador]; if (t && t.efeito === 'blue') { comprarItem(st, p, 1); log(st, 'Blue: compra um Item pela captura.'); }
  }
  function ganharCor(st, p, cor, n) { for (let i = 0; i < n; i++) { const c = tirar(st, cor); if (c) ganharPokemon(st, p, c, 'Pokémon ' + cor + ' aleatório'); } }
  function revelar(st, slotKey) { const s = st.slots[slotKey]; if (s && s.carta && !s.aberta) { s.aberta = true; log(st, `Revelado: ${P(s.carta).nome}.`, '', [['pk', s.carta]]); return true; } return false; }
  // ---------- Repel: janela de reação a cada revelação no tabuleiro ----------
  const temRepel = q => q.itens.find(i => i.split('#')[0] === 'repel');
  function holdersRepel(st) { return st.jogadores.filter(q => !q.eliminado && temRepel(q) && !(st.repelPausa && st.repelPausa[q.id])).map(q => q.id); }
  // abre a janela (se alguém puder reagir) segurando o que viria depois (st.pend atual, ex.: a captura)
  function janelaRepel(st, slots) {
    slots = (slots || []).filter(k => st.slots[k] && st.slots[k].carta && st.slots[k].aberta); if (!slots.length) return;
    const h = holdersRepel(st); if (!h.length) return;
    st.pend = { tipo: 'repel', slots, opcoes: h, resp: {}, depois: st.pend || null, ativador: atv(st), seq: (st.reacSeq = (st.reacSeq || 0) + 1), titulo: 'Pokémon revelado' + (slots.length > 1 ? 's' : '') };
  }
  // escolha: chave do espaço (usar Repel nele), 'nao' ou 'pausa' (não usar até o próprio próximo turno)
  function reagirRepel(st, j, escolha) {
    const pd = st.pend; if (!pd || pd.tipo !== 'repel' || !pd.opcoes.includes(j) || pd.resp[j] != null) return;
    if (escolha !== 'nao' && escolha !== 'pausa' && !pd.slots.includes(escolha)) return;
    pd.resp[j] = escolha;
    if (escolha === 'pausa') { st.repelPausa = st.repelPausa || {}; st.repelPausa[j] = true; }
    if (pd.opcoes.every(x => pd.resp[x] != null)) finalizarRepel(st);
  }
  function encerrarRepel(st) { const pd = st.pend; if (!pd || pd.tipo !== 'repel') return; pd.opcoes.forEach(x => { if (pd.resp[x] == null) pd.resp[x] = 'nao'; }); finalizarRepel(st); }
  function finalizarRepel(st) {
    const pd = st.pend, N = st.jogadores.length, g = grafo(st), trocados = [];
    const ordem = st.jogadores.map((_, k) => (pd.ativador + k) % N).filter(j => pd.opcoes.includes(j));
    ordem.forEach(j => {
      const k = pd.resp[j]; if (!pd.slots.includes(k) || trocados.includes(k)) return;
      const q = J(st, j), inst = temRepel(q); if (!inst) return;
      const cor = g.slots[k].cor, dk = st.decks[cor] || [], velho = st.slots[k].carta;
      if (!dk.length) { log(st, `Repel: não há outro Pokémon ${cor} fora do jogo para trocar ${P(velho).nome}.`); return; }
      descartarItem(st, q, inst);
      const novo = dk.splice(Math.floor(rnd(st) * dk.length), 1)[0]; devolver(st, cor, velho);
      st.slots[k] = { carta: novo, aberta: true, fraco: false }; trocados.push(k);
      log(st, `${q.nome} usou Repel: ${P(velho).nome} foi trocado por ${P(novo).nome}.`, 'destaque', [['it', 'repel'], ['pk', velho], ['pk', novo]]);
    });
    const dep = pd.depois;
    if (dep && dep.tipo === 'captura' && dep.slot && trocados.includes(dep.slot)) { dep.carta = st.slots[dep.slot].carta; dep.cor = P(dep.carta).cor; dep.titulo = 'Captura: ' + P(dep.carta).nome; }
    st.pend = dep;
    if (trocados.length) janelaRepel(st, trocados); // a carta nova também é uma revelação
    if (!st.pend) continuar(st);
  }

  // estatísticas por jogador (tela do Mestre Pokémon)
  function est(p) { return p.stats || (p.stats = { eventos: 0, superEventos: 0, bat: {} }); }
  function contaBatalha(st, tipo, ids, venc) { ids.forEach(id => { const b = est(J(st, id)).bat; const x = b[tipo] || (b[tipo] = [0, 0]); x[1]++; if (id === venc) x[0]++; }); }
  function comprarEvento(st, tipo) {
    reporBaralho(st, tipo); const c = st.decks[tipo].shift(); if (!c) { log(st, 'Sem cartas.'); return; }
    est(J(st))[tipo === 'evento' ? 'eventos' : 'superEventos']++;
    const card = (tipo === 'evento' ? idx().ev : idx().sev)[c];
    log(st, `${J(st).nome} comprou ${tipo === 'evento' ? 'o Evento' : 'o Super Evento'} "${card.nome}".`, '', [[tipo === 'evento' ? 'ev' : 'sev', c]]);
    st.pend = { tipo: 'carta', baralho: tipo, carta: c, ativado: false, titulo: card.nome };
  }
  // ---------- Reações a Eventos: Exp. Share e Poké-Flauta ----------
  const itemDe = (p, id) => p.itens.find(i => i.split('#')[0] === id);
  function reagentes(st) {
    const ativ = atv(st), out = {};
    st.jogadores.forEach(q => { const op = []; if (q.id !== ativ && itemDe(q, 'expshare')) op.push('exp'); if (q.id !== ativ && temMay(q)) op.push('may'); if (itemDe(q, 'pokeflute')) op.push('flauta'); if (op.length) out[q.id] = op; });
    return out;
  }
  const temMay = q => !!(q.treinador && idx().tr[q.treinador] && idx().tr[q.treinador].efeito === 'may');
  // passos da carta com as compras de Itens marcadas como "de Evento" (para o Wally)
  function marcarEv(x) {
    if (Array.isArray(x)) { if (x[0] === 'itens' && typeof x[1] === 'number') return ['itensEv'].concat(x.slice(1)); return x.map(marcarEv); }
    if (x && typeof x === 'object') { const o = {}; for (const k in x) o[k] = marcarEv(x[k]); return o; }
    return x;
  }
  const passosCarta = card => marcarEv(card.auto || []);
  function iniciarReacoes(st) {
    const pd = st.pend; if (!pd || pd.tipo !== 'carta' || pd.ativado || pd.reacao != null) return;
    const r = reagentes(st);
    if (!Object.keys(r).length) { pd.reacao = 'ok'; return; }
    pd.reacao = { opcoes: r, resp: {}, ativador: atv(st), seq: (st.reacSeq = (st.reacSeq || 0) + 1) };
  }
  function reacaoAberta(st) { const pd = st.pend; return !!(pd && pd.tipo === 'carta' && pd.reacao && pd.reacao !== 'ok'); }
  function reagir(st, j, escolha) {
    const pd = st.pend; if (!reacaoAberta(st)) return; const R = pd.reacao, op = R.opcoes[j];
    if (!op || R.resp[j] != null) return; if (escolha !== 'nao' && !op.includes(escolha)) return;
    R.resp[j] = escolha;
    if (Object.keys(R.opcoes).every(k => R.resp[k] != null)) finalizarReacoes(st);
  }
  function encerrarReacoes(st) { const pd = st.pend; if (!reacaoAberta(st)) return; Object.keys(pd.reacao.opcoes).forEach(k => { if (pd.reacao.resp[k] == null) pd.reacao.resp[k] = 'nao'; }); finalizarReacoes(st); }
  function finalizarReacoes(st) {
    const pd = st.pend, R = pd.reacao, N = st.jogadores.length;
    const ordem = st.jogadores.map((_, k) => (R.ativador + 1 + k) % N); // ordem da mesa, a partir de quem joga depois do ativador
    const flaut = ordem.find(j => R.resp[j] === 'flauta');
    const card = (pd.baralho === 'evento' ? idx().ev : idx().sev)[pd.carta];
    if (flaut != null) {
      const q = J(st, flaut); descartarItem(st, q, itemDe(q, 'pokeflute'));
      log(st, `${q.nome} tocou a Poké-Flauta: "${card.nome}" foi cancelado e o próximo ${pd.baralho === 'evento' ? 'Evento' : 'Super Evento'} será ativado.`, 'destaque', [['it', 'pokeflute'], [pd.baralho === 'evento' ? 'ev' : 'sev', pd.carta]]);
      if (pd.carta !== 'gsball') st.descartes[pd.baralho].push(pd.carta);
      reporBaralho(st, pd.baralho); const nova = st.decks[pd.baralho].shift();
      if (!nova) { st.pend = null; continuar(st); return; }
      const c2 = (pd.baralho === 'evento' ? idx().ev : idx().sev)[nova];
      log(st, `Novo ${pd.baralho === 'evento' ? 'Evento' : 'Super Evento'}: "${c2.nome}".`, '', [[pd.baralho === 'evento' ? 'ev' : 'sev', nova]]);
      st.pend = { tipo: 'carta', baralho: pd.baralho, carta: nova, ativado: false, titulo: c2.nome };
      iniciarReacoes(st); return;
    }
    pd.copias = ordem.filter(j => R.resp[j] === 'exp' || R.resp[j] === 'may'); pd.copiaFonte = {}; pd.copias.forEach(j => pd.copiaFonte[j] = R.resp[j]);
    if (pd.copias.length) log(st, pd.copias.map(j => `${J(st, j).nome} vai copiar "${card.nome}" ${R.resp[j] === 'may' ? 'reciclando a May' : 'com Exp. Share'}`).join('; ') + '.', 'destaque', pd.copias.map(j => R.resp[j] === 'may' ? ['tr', J(st, j).treinador] : ['it', 'expshare']));
    pd.reacao = 'ok';
  }
  function ativarCarta(st) {
    const pd = st.pend; if (!pd || pd.tipo !== 'carta' || pd.ativado) return;
    if (pd.reacao == null) iniciarReacoes(st);
    if (reacaoAberta(st)) return;
    pd.ativado = true;
    const card = (pd.baralho === 'evento' ? idx().ev : idx().sev)[pd.carta];
    st.cartaAtiva = card.nome; st.ganhosCarta = []; st.trocasCarta = [];
    const passos = passosCarta(card);
    if (!passos.length) { log(st, 'Efeito manual: use a caixa de ferramentas para aplicar.'); return; }
    const resto = { pend: st.pend }; st.pend = null; executar(st, passos.concat([['voltarCarta', resto.pend]]));
  }
  function concluirCarta(st) {
    let pd = st.pend; if (!pd || pd.tipo !== 'carta') return;
    if (pd.reacao == null) iniciarReacoes(st);
    if (reacaoAberta(st)) encerrarReacoes(st);
    if (st.pend !== pd) return; // a Flauta trocou o Evento
    pd = st.pend;
    if (pd.carta !== 'gsball') st.descartes[pd.baralho].push(pd.carta);
    st.pend = null; st.ganhosCarta = null; st.trocasCarta = null;
    const card = (pd.baralho === 'evento' ? idx().ev : idx().sev)[pd.carta];
    (st.efeitos || []).filter(e => e.tipo === 'suborno' && e.dono !== atv(st)).forEach(e => {
      const d = J(st, e.dono); e.copiou = true;
      if (card.auto && card.auto.length && card.autoCompleto) { log(st, `Suborno Rocket: ${d.nome} copia "${card.nome}".`, 'destaque', [[pd.baralho === 'evento' ? 'ev' : 'sev', pd.carta]]); st.fila = [['comoJogador', e.dono, passosCarta(card)]].concat(st.fila || []); }
      else log(st, `Suborno Rocket: ${d.nome} copia "${card.nome}" — aplique o efeito para ${d.nome} pela caixa de ferramentas.`, 'destaque', [[pd.baralho === 'evento' ? 'ev' : 'sev', pd.carta]]);
    });
    const copias = [];
    (pd.copias || []).forEach(j => {
      const q = J(st, j), fonte = (pd.copiaFonte || {})[j] || 'exp', ref = [pd.baralho === 'evento' ? 'ev' : 'sev', pd.carta];
      let nomeF, refF;
      if (fonte === 'may') {
        if (!temMay(q)) return; refF = ['tr', q.treinador]; nomeF = 'May';
        st.descartes.treinador.push(q.treinador); q.treinador = null; log(st, `${q.nome} reciclou a May.`, '', [refF]); reporTreinadores(st);
      } else { const it = itemDe(q, 'expshare'); if (!it) return; descartarItem(st, q, it); nomeF = 'Exp. Share'; refF = ['it', 'expshare']; }
      if (card.auto && card.auto.length && card.autoCompleto) { log(st, `${nomeF}: ${q.nome} copia "${card.nome}".`, 'destaque', [refF, ref]); copias.push(['comoJogador', j, passosCarta(card)]); }
      else log(st, `${nomeF}: ${q.nome} copia "${card.nome}" — aplique o efeito para ${q.nome} pela caixa de ferramentas.`, 'destaque', [refF, ref]);
    });
    if (copias.length) st.fila = copias.concat(st.fila || []);
    continuar(st);
  }

  // executor de passos (efeitos). Passos que exigem escolha criam st.pend e o restante fica em st.fila.
  function executar(st, passos) { st.fila = passos.concat(st.fila || []); continuar(st); }
  function continuar(st) {
    while (!st.pend && st.fila && st.fila.length) {
      const [op, a, b, st_nome] = st.fila.shift(), p = J(st);
      if (op === 'itens') comprarItem(st, p, a);
      else if (op === 'itensEv') ganharItens(st, p, a);
      else if (op === 'ligaProx') ligaProxima(st);
      else if (op === 'capturaCyn') { if (!a.slot || (st.slots[a.slot] && st.slots[a.slot].carta === a.carta)) { iniciarCaptura(st, a.slot ? { slot: a.slot } : { carta: a.carta, cor: a.cor }); st.pend.cyn = a.tentaram; st.pend.titulo = 'Cynthia — Captura: ' + P(a.carta).nome; } }
      else if (op === 'pracaPremio') st.pend = { tipo: 'pracaPremio', titulo: `Festival de Praça: ${p.nome}, escolha o prêmio` };
      else if (op === 'wallyCompra') { if (wallyOk(p)) st.pend = { tipo: 'wally', n: a, titulo: `Wally: descartar um Item antes de comprar ${a === 1 ? 'o Item' : 'os ' + a + ' Itens'} e comprar 1 a mais?` }; else comprarItem(st, p, a); }
      else if (op === 'treinador') comprarTreinador(st, p, a);
      else if (op === 'ganhar') ganharCor(st, p, a === 'espaco' ? corEspaco(st) : a, b || 1);
      else if (op === 'capturar') { const c = tirar(st, a); if (c) iniciarCaptura(st, { carta: c, cor: a }); }
      else if (op === 'pular') { p.pular += a; log(st, `${p.nome} vai perder ${a} turno(s).`); }
      else if (op === 'evento') comprarEvento(st, 'evento');
      else if (op === 'superevento') comprarEvento(st, 'superevento');
      else if (op === 'seTipo') { if (temTipo(p, a)) st.fila = b.concat(st.fila); }
      else if (op === 'seCor') { if (temCor(p, a)) st.fila = b.concat(st.fila); }
      else if (op === 'tabela') {
        const v = dado(st); const lin = a.find(l => l[0].includes(v)); const desc = descreverPassos(lin ? lin[1] : []);
        st.rolSeq = (st.rolSeq || 0) + 1; st.rolagem = { seq: st.rolSeq, valor: v, titulo: st.cartaAtiva || 'Rolagem', jogador: p.nome, ok: !!(lin && lin[1].length), texto: desc };
        log(st, `${st.cartaAtiva ? st.cartaAtiva + ' — ' : ''}${p.nome} rolou ${v}: ${desc}.`);
        silver(st, p, [v]);
        if (celebiDe(p)) { st.pend = { tipo: 'tabelaRes', tabela: a, valor: v, ok: !!(lin && lin[1].length), texto: desc, titulo: (st.cartaAtiva || 'Rolagem') + ': resultado ' + v }; }
        else if (lin) st.fila = lin[1].concat(st.fila);
      }
      else if (op === 'texto') { /* só informativo */ }
      else if (op === 'voltarCarta') { st.pend = a; }
      else if (op === 'alvo') pedirAlvo(st, a, b);
      else if (op === 'todos') iniciarTodos(st, a);
      else if (op === 'festival') { const N = st.jogadores.length, ordem = st.jogadores.map((_, k) => (atv(st) + k) % N).filter(j => !J(st, j).eliminado); st.pend = { tipo: 'festival', ordem, i: 0, restam: 2, trocados: [], titulo: 'Festival Pokémon' }; ajustarFestival(st); }
      else if (op === 'juniperFim') { [p, J(st, a)].forEach(x => ganharCor(st, x, 'rosa', 1)); }
      else if (op === 'cartaPronta') { const bar = b || 'evento'; st.pend = { tipo: 'carta', baralho: bar, carta: a, ativado: false, titulo: (bar === 'evento' ? idx().ev : idx().sev)[a].nome }; }
      else if (op === 'azalea') { const cs = []; for (let k = 0; k < 2; k++) { reporBaralho(st, 'evento'); const c = st.decks.evento.shift(); if (c) cs.push(c); } if (cs.length) st.pend = { tipo: 'azalea', cartas: cs, titulo: 'Azalea: escolha o Evento que você ativa (o outro vai para um oponente)' }; }
      else if (op === 'distribuir') { const bar = a && a.baralho || 'evento', cs = []; const vv = st.jogadores.filter(q => !q.eliminado), n = Math.min(a && a.n || vv.length, vv.length); for (let k = 0; k < n; k++) (() => { reporBaralho(st, bar); const c = st.decks[bar].shift(); if (c) cs.push(c); })(); if (cs.length) st.pend = { tipo: 'distribuir', baralho: bar, cartas: cs, jogadores: vv.map(q => q.id), atribuido: {}, titulo: a && a.titulo || 'Distribua um Evento para cada jogador' }; }
      else if (op === 'descAqua') { if (p.itens.length === 1) descartarAqua(st, p, p.itens[0]); else if (p.itens.length) st.pend = { tipo: 'descartarDe', aqua: true, itens: p.itens.slice(), titulo: `Operação Aqua: ${p.nome}, descarte um Item` }; }
      else if (op === 'criadores') st.pend = { tipo: 'criadores', titulo: 'Criadores Pokémon: escolha uma das opções' };
      else if (op === 'aquaCompra') { const pool = (st.opAqua || []).filter(i => st.descartes.item.includes(i)); st.opAqua = null; st.pend = { tipo: 'aquaCompra', pool, resta: 3, titulo: 'Operação Aqua: compre 3 Itens (dos descartados ou da pilha)' }; }
      else if (op === 'fuchsia') { const cs = [tirar(st, 'rosa'), tirar(st, 'rosa')].filter(Boolean); if (cs.length) st.pend = { tipo: 'fuchsia', cartas: cs, titulo: 'Fuchsia: escolha o Pokémon Rosa que você mantém' }; }
      else if (op === 'darPokemon') { const q = J(st, a); ganharPokemon(st, q, b, 'presente'); }
      else if (op === 'efeito') criarEfeito(st, a, b);
      else if (op === 'turnoExtra') { st.turno.turnoExtra = true; log(st, `${p.nome} terá um turno extra.`); }
      else if (op === 'comoJogador') { st.fila = b.concat([['fimAtor', st.ator == null ? null : st.ator]], st.fila); st.ator = a; }
      else if (op === 'fimAtor') { st.ator = a; }
      else if (op === 'slotSel') slotSel(st, Object.assign({}, a, a.coresDelibird ? { cores: noPlanalto(st) ? ESCALA : [corEspaco(st)] } : {}));
      else if (op === 'rota') rotaBloqueada(st);
      else if (op === 'tempestade') tempestade(st);
      else if (op === 'tipoCor') pedirTipoCor(st, a);
      else if (op === 'revelarEscolher') revelarEscolher(st, a, b, st_nome);
      else if (op === 'espaco') pedirEspaco(st, a || {});
      else if (op === 'novoInicio') novoInicio(st);
      else if (op === 'gsball') gsBall(st);
      else if (op === 'liderFora') pedirLiderFora(st);
      else if (op === 'pagar') pedirPagamento(st, a, b, st_nome);
      else if (op === 'propostaN') propostaN(st);
      else if (op === 'negociador') negociador(st);
      else if (op === 'sabrina') sabrina(st);
      else if (op === 'navTr') {}
      else if (op === 'ranking') iniciarRanking(st, a);
      else if (op === 'paraJogador') paraJogador(st, a, b, st_nome);
      else if (op === 'ruinas') ruinas(st);
      else if (op === 'kurt') kurt(st);
      else if (op === 'treinadorDe') comprarTreinador(st, J(st, a), 1);
      else if (op === 'opcao') st.pend = { tipo: 'opcao', opcoes: a, titulo: b || 'Escolha uma opção' };
      else if (op === 'dividir') { const its = comprarItem(st, p, 2, true); p.itens = p.itens.filter(i => !its.includes(i)); if (its.length) st.pend = { tipo: 'dividir', itens: its, titulo: 'Fique com um Item; o outro vai para ' + J(st, (atv(st) + 1) % st.jogadores.length).nome }; }
      else if (op === 'especialE') { const s0 = { especial: a }; especial(st, s0, p.pos); }
      else if (op === 'travarPend') { if (p.pokemon.length) st.pend = { tipo: 'travar', titulo: '6ª insígnia: trave e melhore (+1) uma família' }; }
    }
  }
  function aceitarTabela(st) { const pd = st.pend; if (!pd || pd.tipo !== 'tabelaRes') return; const lin = pd.tabela.find(l => l[0].includes(pd.valor)); st.pend = null; if (lin) st.fila = lin[1].concat(st.fila || []); continuar(st); }
  function celebiTabela(st) {
    const pd = st.pend, p = J(st); if (!pd || pd.tipo !== 'tabelaRes' || !celebiDe(p)) return;
    gastarCelebi(st, p); log(st, `${p.nome} usou Pedido a Celebi e rola de novo.`, 'destaque', [['it', 'pedidocelebi']]);
    const tab = pd.tabela; st.pend = null; st.fila = [['tabela', tab]].concat(st.fila || []); continuar(st);
  }
  function descreverPassos(ps) {
    if (!ps || !ps.length) return 'nada acontece';
    const NOME = { evento: 'compra um Evento', superevento: 'compra um Super Evento' };
    return ps.map(([op, a, b]) => op === 'itens' || op === 'itensEv' ? `${a} Carta${a > 1 ? 's' : ''} Item` : op === 'ganhar' ? `ganha ${b > 1 ? b + ' ' : 'um '}Pokémon ${a === 'espaco' ? 'da cor do espaço' : a}` : op === 'capturar' ? `tenta capturar um Pokémon ${a}` : op === 'treinador' ? `${a} Carta${a > 1 ? 's' : ''} de Treinador` : NOME[op] || op).join(' + ');
  }
  function corEspaco(st) { const s = grafo(st).nodes[J(st).pos]; if (s.kind === 'cidade') return ({ t1: 'verde', t2: 'azul', t3: 'vermelho' })[D().hexes[s.hex].tier] || 'rosa'; return s.color === 'cinza' ? 'rosa' : s.color; }

  // ---------- captura ----------
  function iniciarCaptura(st, o) {
    // o: {slot} carta no tabuleiro | {carta, cor} carta fora do jogo
    const id = o.slot ? st.slots[o.slot].carta : o.carta;
    st.pend = { tipo: 'captura', slot: o.slot || null, carta: id, cor: o.cor || P(id).cor, titulo: 'Captura: ' + P(id).nome, resultado: null };
  }
  function faixaCaptura(st, p, id, bola, slot) {
    let r = 0; const it = bola && ITEM(bola); if (it && it.bola) r += it.bola;
    if (slot && st.slots[slot] && st.slots[slot].fraco) r += 1;
    const t = p.treinador && idx().tr[p.treinador]; if (t && t.especialista && P(id).tipos.some(x => t.especialista.includes(x))) r += 1;
    return r;
  }
  function rolarCaptura(st, bola) {
    const pd = st.pend; if (!pd || pd.tipo !== 'captura' || pd.resultado) return; const p = J(st), c = P(pd.carta);
    if (bola) descartarItem(st, p, bola);
    const t = p.treinador && idx().tr[p.treinador];
    const ds = [dado(st)]; if (t && t.efeito === 'red') ds.push(dado(st));
    silver(st, p, ds);
    const R = faixaCaptura(st, p, pd.carta, bola, pd.slot);
    let ok = false;
    if (c.captura.length) for (const d of ds) for (let m = -R; m <= R; m++) if (c.captura.includes(d + m)) ok = true;
    pd.resultado = { dados: ds, faixa: R, ok, bola: bola || null };
    if (ok) {
      if (pd.slot) { st.slots[pd.slot] = { carta: tirar(st, pd.cor), aberta: false, fraco: false }; }
      ganharPokemon(st, p, pd.carta, 'capturado');
    } else {
      if (pd.slot) { pd.resultado.prevFraco = st.slots[pd.slot].fraco; if (c.cor !== 'amarelo') st.slots[pd.slot].fraco = true; }
      else { devolver(st, pd.cor, pd.carta); pd.resultado.devolvido = true; }
      log(st, `${p.nome} falhou na captura de ${c.nome} (dado ${ds.join(' e ')}${R ? ', ajuste ±' + R : ''}).`);
    }
  }
  // ---------- Cynthia: tentar a captura que alguém do seu hexágono falhou (antes do enfraquecimento) ----------
  const temCynthia = q => !!(q.treinador && idx().tr[q.treinador] && idx().tr[q.treinador].efeito === 'cynthia');
  function cynthia(st, pd) {
    const g = grafo(st), cap = atv(st), hex = g.nodes[J(st, cap).pos].pos, tent = (pd.cyn || []).concat([cap]), N = st.jogadores.length;
    const fila = st.jogadores.map((_, k) => (cap + 1 + k) % N).filter(j => !tent.includes(j) && !J(st, j).eliminado && temCynthia(J(st, j)) && g.nodes[J(st, j).pos].pos === hex);
    if (!fila.length) return false;
    st.pend = { tipo: 'cynthia', fila, tentaram: tent, carta: pd.carta, slot: pd.slot, cor: pd.cor, prevFraco: pd.resultado.prevFraco, devolvido: !!pd.resultado.devolvido, capturador: cap, respondente: fila[0], titulo: `Cynthia: ${J(st, fila[0]).nome}, tentar capturar ${P(pd.carta).nome}?` };
    return true;
  }
  function responderCynthia(st, sim) {
    const pd = st.pend; if (!pd || pd.tipo !== 'cynthia') return;
    const j = pd.respondente;
    if (!sim) {
      pd.fila.shift(); if (pd.fila.length) { pd.respondente = pd.fila[0]; pd.titulo = `Cynthia: ${J(st, pd.fila[0]).nome}, tentar capturar ${P(pd.carta).nome}?`; return; }
      st.pend = null; continuar(st); return;
    }
    // desfaz o enfraquecimento / a devolução e passa a carta para quem tem a Cynthia
    if (pd.slot) st.slots[pd.slot].fraco = pd.prevFraco;
    else if (pd.devolvido) { const dk = st.decks[pd.cor], i = dk.lastIndexOf(pd.carta); if (i >= 0) dk.splice(i, 1); }
    log(st, `Cynthia: ${J(st, j).nome} tenta capturar ${P(pd.carta).nome}, que ${J(st, pd.capturador).nome} não conseguiu.`, 'destaque', [['tr', J(st, j).treinador], ['pk', pd.carta]]);
    st.pend = null;
    st.fila = [['comoJogador', j, [['capturaCyn', { slot: pd.slot, carta: pd.carta, cor: pd.cor, tentaram: pd.tentaram.concat([j]) }]]]].concat(st.fila || []);
    continuar(st);
  }
  // ---------- Pedido a Celebi: refazer uma rolagem ----------
  const celebiDe = p => p.itens.find(i => i.split('#')[0] === 'pedidocelebi');
  function gastarCelebi(st, p) { const c = celebiDe(p); if (!c) return false; descartarItem(st, p, c); return true; }
  function celebiMovimento(st, k) {
    const p = J(st), t = st.turno; if (st.fase !== 'mover' || !t || !t.dados || !celebiDe(p)) return;
    k = k || 0; if (k >= t.dados.length) return;
    gastarCelebi(st, p); const antes = t.dados[k], nv = dado(st); t.dados[k] = nv; silver(st, p, [nv]);
    log(st, `${p.nome} usou Pedido a Celebi: refez o dado (${antes} → ${nv}).`, 'destaque', [['it', 'pedidocelebi']]);
    t.celebi = (t.celebi || 0) + 1; t.escolhido = null;
    if (t.dados.length > 1) { t.rolagem = null; t.destinos = null; return; }
    t.rolagem = nv;
    if (encrencado(st, p)) { t.rolagem = 1; return calcDestinos(st); }
    calcDestinos(st);
  }
  function celebiCaptura(st) {
    const pd = st.pend, p = J(st); if (!pd || pd.tipo !== 'captura' || !pd.resultado || pd.resultado.ok || !celebiDe(p)) return;
    const r = pd.resultado, c = P(pd.carta);
    if (pd.slot) st.slots[pd.slot].fraco = r.prevFraco;
    else if (r.devolvido) { const dk = st.decks[pd.cor], i = dk.lastIndexOf(pd.carta); if (i >= 0) dk.splice(i, 1); }
    gastarCelebi(st, p);
    const ds = r.dados.map(() => dado(st)); silver(st, p, ds);
    log(st, `${p.nome} usou Pedido a Celebi e refez a captura (${r.dados.join(' e ')} → ${ds.join(' e ')}).`, 'destaque', [['it', 'pedidocelebi']]);
    const R = r.faixa; let ok = false;
    if (c.captura.length) for (const d of ds) for (let m = -R; m <= R; m++) if (c.captura.includes(d + m)) ok = true;
    pd.resultado = { dados: ds, faixa: R, ok, bola: r.bola, celebi: (r.celebi || 0) + 1 };
    if (ok) { if (pd.slot) st.slots[pd.slot] = { carta: tirar(st, pd.cor), aberta: false, fraco: false }; ganharPokemon(st, p, pd.carta, 'capturado'); }
    else {
      if (pd.slot) { pd.resultado.prevFraco = st.slots[pd.slot].fraco; if (c.cor !== 'amarelo') st.slots[pd.slot].fraco = true; }
      else { devolver(st, pd.cor, pd.carta); pd.resultado.devolvido = true; }
      log(st, `${p.nome} falhou na captura de ${c.nome} (dado ${ds.join(' e ')}${R ? ', ajuste ±' + R : ''}).`);
    }
  }
  function celebiLider(st) {
    const pd = st.pend, p = J(st); if (!pd || pd.tipo !== 'lider' || !pd.resultado || pd.resultado.ok || !celebiDe(p)) return;
    const r = pd.resultado, L = idx().ld[pd.lider]; gastarCelebi(st, p);
    const nd = dado(st); silver(st, p, [nd]);
    const total = r.total - r.dado + nd, ok = total >= r.lider;
    log(st, `${p.nome} usou Pedido a Celebi contra ${L.nome} (dado ${r.dado} → ${nd}): ${total} × ${r.lider} — ${ok ? 'vitória!' : 'derrota.'}`, ok ? 'destaque' : '', [['it', 'pedidocelebi'], ['ld', L.id]]);
    pd.resultado = Object.assign({}, r, { dado: nd, total, ok, seq: st.log.length, celebi: (r.celebi || 0) + 1 });
    if (ok) vencerLider(st, p, L, pd.cidade);
  }
  function fecharPend(st) { const pd = st.pend; if (!pd) return; if (pd.tipo === 'lider' && pd.resultado && pd.resultado.ok != null) contaBatalha(st, 'lider', [atv(st)], pd.resultado.ok ? atv(st) : null); if (pd.tipo === 'captura' && pd.resultado && !pd.resultado.ok && cynthia(st, pd)) return; if (pd.tipo === 'carta') return concluirCarta(st); if (pd.tipo === 'liga') { st.pend = null; iniciarLiga(st, atv(st)); if (!st.pend) continuar(st); return; } st.pend = null; continuar(st); }
  function escolherCaptura(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'escolherCaptura' || !pd.cartas.includes(id)) return;
    pd.cartas.filter(c => c !== id).forEach(c => devolver(st, P(c).cor, c)); st.pend = null; iniciarCaptura(st, { carta: id, cor: P(id).cor });
  }
  function escolherEvento(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'escolherEvento') return;
    pd.cartas.filter(c => c !== id).forEach(c => st.descartes.evento.push(c));
    st.pend = { tipo: 'carta', baralho: 'evento', carta: id, ativado: false, titulo: idx().ev[id].nome };
    log(st, `${J(st).nome} escolheu o Evento "${idx().ev[id].nome}".`, '', [['ev', id]]);
  }

  // ---------- travar família ----------
  function travar(st, familia) {
    const pd = st.pend; const p = J(st, pd && pd.jogador != null ? pd.jogador : atv(st));
    if (!p.travadas.includes(familia)) p.travadas.push(familia);
    log(st, `${p.nome} travou a família de ${P(familia) ? P(familia).nome : familia} (+1, protegida de trocas).`);
    st.pend = null; continuar(st);
  }

  // ---------- batalha contra Líder ----------
  function abrirLider(st, k) {
    const p = J(st); k = k || p.pos; const lid = st.lideres[k]; if (!lid || st.turno.batalhouLider) return;
    st.pend = { tipo: 'lider', cidade: k, lider: lid, titulo: 'Batalha de Ginásio: ' + idx().ld[lid].nome, resultado: null };
  }
  function lutarLider(st, escolhidos, itensUsados) {
    const pd = st.pend; if (!pd || pd.tipo !== 'lider') return; const p = J(st), L = idx().ld[pd.lider];
    const n = L.dual ? 2 : 1; if (escolhidos.length !== n) return;
    const d = dado(st); silver(st, p, [d]);
    let total = d, det = [];
    escolhidos.forEach((id, i) => {
      const c = P(id), base = forcaBase(p, id), v = vantagem(c.vantagens, [L.tipo]), tr = bonusTreinador(p, id), it = itensUsados[i] ? bonusItemBatalha(itensUsados[i], id) : 0;
      total += base + v + tr + it; det.push({ id, base, forca: c.forca, evol: base - c.forca, v, tr, it, itemId: itensUsados[i] ? itensUsados[i].split('#')[0] : null, lv: vantagem(L.vantagens, c.tipos) });
    });
    let lt = L.forca; const lv = escolhidos.reduce((s, id) => s + vantagem(L.vantagens, P(id).tipos), 0); lt += lv;
    itensUsados.filter(Boolean).forEach(inst => descartarItem(st, p, inst));
    const ok = total >= lt;
    pd.resultado = { dado: d, total, lider: lt, liderVant: lv, det, ok, seq: st.log.length };
    if (!pd.alternativo) st.turno.batalhouLider = true;
    log(st, `${p.nome} enfrentou ${L.nome}: ${total} × ${lt} — ${ok ? 'vitória!' : 'derrota.'}`, ok ? 'destaque' : '', [['ld', L.id]]);
    if (ok) vencerLider(st, p, L, pd.cidade);
  }
  function remedio(st, inst) {
    const pd = st.pend; if (!pd || pd.tipo !== 'lider' || !pd.resultado || pd.resultado.ok) return; const p = J(st);
    descartarItem(st, p, inst); pd.resultado = null; st.turno.batalhouLider = false; log(st, `${p.nome} usou Remédio e recomeça a batalha.`);
  }
  function slotInsignia(p, faixa) { const base = { '1-2': 0, '3-4': 2, '5-6': 4 }[faixa]; if (base == null) return -1; if (!p.insignias[base]) return base; if (!p.insignias[base + 1]) return base + 1; return -1; }
  function podeEnfrentar(p, L) { return !p.lideresVencidos.includes(L.id) && slotInsignia(p, L.insignias) >= 0; }
  function vencerLider(st, p, L, cidade) {
    p.lideresVencidos.push(L.id); const sl = slotInsignia(p, L.insignias);
    ganharItens(st, p, 1);
    if (sl >= 0) {
      p.insignias[sl] = L.id; log(st, `${p.nome} conquistou a ${sl + 1}ª insígnia (${L.nome}).`, 'destaque');
      const recompensa = [null, null, ['ganhar', 'azul', 1], null, ['ganhar', 'vermelho', 1], null][sl];
      const txt = ['Pokémons Azuis agora te obedecem.', 'Pokémons Vermelhos agora te obedecem.', 'Ganhe um Pokémon Azul aleatório.', 'Pokémons Amarelos agora te obedecem.', 'Ganhe um Pokémon Vermelho aleatório.', 'Trave e melhore (+1) uma família de Pokémon.'][sl];
      log(st, 'Recompensa: ' + txt);
      if (recompensa) st.fila.push(recompensa);
      if (sl === 5) st.fila.push(['travarPend']);
    }
  }

  // ---------- Festival de Praça: dupla contra dupla, só Pokémons abaixo de Azul ----------
  const CORES_PRACA = ['inicial', 'rosa', 'verde'];
  const pracaAptosDe = q => q.pokemon.filter(id => CORES_PRACA.includes(P(id).cor) && obedece(q, P(id).cor));
  function iniciarPraca(st, a, b) {
    st.pend = { tipo: 'praca', uid: (st.uid = (st.uid || 0) + 1), a, b, dupla: { a: null, b: null }, itens: { a: {}, b: {} }, resultado: null, titulo: `Festival de Praça: ${J(st, a).nome} × ${J(st, b).nome}` };
    log(st, `Festival de Praça: ${J(st, a).nome} desafia ${J(st, b).nome}. Os dois escolhem as duplas em segredo.`, 'destaque');
  }
  function pracaForca(st, pi, id, inst, opTipos) {
    const p = J(st, pi), c = P(id);
    const d = { pokemon: id, base: c.forca, evol: bonusEvolucao(p, id, CORES_PRACA) + bonusTravada(p, id), trein: bonusTreinador(p, id), vant: vantagem(c.vantagens, opTipos), item: inst ? bonusItemBatalha(inst, id) : 0, itemId: inst ? inst.split('#')[0] : null };
    d.forca = d.base + d.evol + d.trein + d.vant + d.item; return d;
  }
  // ids: 1 ou 2 Pokémons (2 se tiver); itens: { id: instância }
  function escolherDuplaPraca(st, lado, ids, itens) {
    const pd = st.pend; if (!pd || pd.tipo !== 'praca' || pd.resultado || !['a', 'b'].includes(lado) || pd.dupla[lado] || !Array.isArray(ids)) return;
    const q = J(st, pd[lado]), ap = pracaAptosDe(q), n = Math.min(2, ap.length);
    if (ids.length !== n || new Set(ids).size !== n || !ids.every(id => ap.includes(id))) return;
    const its = {}, usados = new Set();
    Object.entries(itens || {}).forEach(([id, inst]) => { if (ids.includes(id) && inst && q.itens.includes(inst) && !usados.has(inst) && ITEM(inst).uso === 'batalha' && ITEM(inst).bonus) { its[id] = inst; usados.add(inst); } });
    pd.dupla[lado] = ids; pd.itens[lado] = its;
    if (pd.dupla.a && pd.dupla.b) {
      ['a', 'b'].forEach(l => log(st, `Festival de Praça: ${J(st, pd[l]).nome} escolheu ${pd.dupla[l].map(id => P(id).nome).join(' e ')}.`, '', pd.dupla[l].map(id => ['pk', id])));
      resolverPraca(st);
    }
  }
  function resolverPraca(st) {
    const pd = st.pend, tipos = l => [...new Set(pd.dupla[l].flatMap(id => P(id).tipos))];
    const det = { a: pd.dupla.a.map(id => pracaForca(st, pd.a, id, pd.itens.a[id], tipos('b'))), b: pd.dupla.b.map(id => pracaForca(st, pd.b, id, pd.itens.b[id], tipos('a'))) };
    ['a', 'b'].forEach(l => Object.values(pd.itens[l]).forEach(inst => descartarItem(st, J(st, pd[l]), inst)));
    const sa = det.a.reduce((x, d) => x + d.forca, 0), sb = det.b.reduce((x, d) => x + d.forca, 0);
    let da, db, empates = 0;
    for (;;) { da = dado(st); db = dado(st); silver(st, J(st, pd.a), [da]); silver(st, J(st, pd.b), [db]); if (sa + da !== sb + db) break; empates++; log(st, `Festival de Praça: empate em ${sa + da} — os dois rolam de novo.`); }
    const venc = sa + da > sb + db ? pd.a : pd.b;
    pd.resultado = { det, sa, sb, da, db, fa: sa + da, fb: sb + db, venc, empates, seq: st.log.length };
  }
  // Pedido a Celebi no Festival de Praça (quem joga a vez): refaz o próprio dado ou o do adversário
  function celebiPraca(st, lado) {
    const pd = st.pend, p = J(st); if (!pd || pd.tipo !== 'praca' || !pd.resultado || !celebiDe(p) || ![pd.a, pd.b].includes(p.id) || !['a', 'b'].includes(lado)) return;
    gastarCelebi(st, p); const dono = J(st, pd[lado]);
    log(st, `${p.nome} usou Pedido a Celebi no dado de ${dono.id === p.id ? 'si mesmo' : dono.nome}.`, 'destaque', [['it', 'pedidocelebi']]);
    if (dono.id !== p.id && temBoneca(dono)) { st.pend = { tipo: 'boneca', acao: 'Pedido a Celebi', alvo: dono.id, atacante: p.id, respondente: dono.id, bloqueado: false, praca: pd, lado, titulo: `${dono.nome}: usar Poké-Boneca contra o Pedido a Celebi?` }; return; }
    rerolarLadoPraca(st, pd, lado);
  }
  function rerolarLadoPraca(st, pd, lado) {
    const r = pd.resultado, nd = dado(st), antes = lado === 'a' ? r.da : r.db; silver(st, J(st, pd[lado]), [nd]);
    if (lado === 'a') r.da = nd; else r.db = nd;
    while (r.sa + r.da === r.sb + r.db) { r.da = dado(st); r.db = dado(st); r.empates++; log(st, 'Festival de Praça: empate — os dois rolam de novo.'); }
    r.fa = r.sa + r.da; r.fb = r.sb + r.db; r.venc = r.fa > r.fb ? pd.a : pd.b; r.celebi = (r.celebi || 0) + 1; r.seq = st.log.length + 1000 * r.celebi;
    log(st, `Dado refeito (${antes} → ${nd}): ${J(st, pd.a).nome} ${r.fa} × ${r.fb} ${J(st, pd.b).nome} — ${J(st, r.venc).nome} vence.`, 'destaque');
    log(st, `Festival de Praça: ${J(st, pd.a).nome} ${sa + da} × ${sb + db} ${J(st, pd.b).nome} — ${J(st, venc).nome} vence.`, 'destaque');
  }
  function fecharPraca(st) {
    const pd = st.pend; if (!pd || pd.tipo !== 'praca' || !pd.resultado) return;
    contaBatalha(st, 'praca', [pd.a, pd.b], pd.resultado.venc);
    st.pend = null; st.fila = [['comoJogador', pd.resultado.venc, [['pracaPremio']]]].concat(st.fila || []); continuar(st);
  }
  const PREMIOS_PRACA = { itens: ['3 Itens', [['itensEv', 3]]], evento: ['1 Evento', [['evento']]], azul: ['1 Pokémon Azul', [['ganhar', 'azul', 1]]], verde: ['2 Pokémons Verdes', [['ganhar', 'verde', 2]]], rosa: ['3 Pokémons Rosas', [['ganhar', 'rosa', 3]]] };
  function resolverPracaPremio(st, k) {
    const pd = st.pend; if (!pd || pd.tipo !== 'pracaPremio' || !PREMIOS_PRACA[k]) return;
    log(st, `Festival de Praça: ${J(st).nome} escolheu ${PREMIOS_PRACA[k][0]}.`, 'destaque');
    st.pend = null; st.fila = PREMIOS_PRACA[k][1].concat(st.fila || []); continuar(st);
  }

  // ---------- Liga Pokémon: formato Mata-Mata ----------
  const FASE_LIGA = { r1: '1ª rodada', r1a: '1ª rodada', r1b: 'Repescagem', semis: 'Semifinal', final: 'Final', duas: 'Batalha', tres: 'Batalha' };
  function planaltoKey(st) { const n = Object.values(grafo(st).nodes).find(x => x.especial === 'planalto'); return n && n.key; }
  function irPlanalto(st, ids) { const k = planaltoKey(st); if (k) ids.forEach(id => { J(st, id).pos = k; }); }
  // ranking de capturas; desempate pela soma das forças e depois sorteio
  function porCapturas(st, ids) {
    const f = id => J(st, id).pokemon.reduce((a, x) => a + P(x).forca, 0), sorte = {}; ids.forEach(id => sorte[id] = rnd(st));
    return ids.slice().sort((a, b) => J(st, b).capturas - J(st, a).capturas || f(b) - f(a) || sorte[a] - sorte[b]);
  }
  function iniciarLiga(st, g) {
    const ids = st.jogadores.map(q => q.id), N = ids.length;
    st.liga = { n: N, ativos: ids.slice(), elim: [], etapa: null, vit: {}, venceu: {}, hist: [], fila: [], perdedores: [], classificados: [], finalTurnos: null, iniciador: g };
    const L = st.liga;
    irPlanalto(st, ids); st.jogadores.forEach(q => { q.planalto = true; });
    log(st, 'A Liga Pokémon começa (Mata-Mata)! Todos os jogadores são levados ao Planalto Índigo — quem não tem 6 insígnias entra sem os benefícios das que faltam.', 'destaque');
    const pio = st.pioneiroPlanalto != null ? st.pioneiroPlanalto : g;
    if (N === 1) return coroar(st, g);
    if (N === 2) { L.etapa = 'duas'; return ligaGatilho(st, g); }
    if (N === 3) { L.etapa = 'tres'; return ligaGatilho(st, g); }
    if (N === 4) { L.etapa = 'semis'; const esc = porCapturas(st, ids)[0]; log(st, `Semifinais: ${J(st, esc).nome} tem mais capturas e escolhe o oponente.`); return pedirOponente(st, esc, ids.filter(x => x !== esc), 'semis'); }
    L.etapa = 'r1';
    if (N === 5) {
      const cls = porCapturas(st, ids.filter(x => x !== pio))[0]; L.classificados = [cls];
      log(st, `1ª rodada: ${J(st, cls).nome} (mais capturas) já está nas semifinais. ${J(st, pio).nome} (pioneiro do Planalto) escolhe o oponente.`, 'destaque');
      return pedirOponente(st, pio, ids.filter(x => x !== pio && x !== cls), 'r1a');
    }
    const cls = porCapturas(st, ids.filter(x => x !== pio))[0]; L.classificados = [pio, cls];
    const resto = embaralhar(st, ids.filter(x => x !== pio && x !== cls));
    for (let i = 0; i + 1 < resto.length; i += 2) L.fila.push([resto[i], resto[i + 1], 'r1']);
    log(st, `1ª rodada: ${J(st, pio).nome} (pioneiro do Planalto) e ${J(st, cls).nome} (mais capturas) já estão nas semifinais. Confrontos sorteados: ${L.fila.map(([a, b]) => J(st, a).nome + ' × ' + J(st, b).nome).join('; ')}.`, 'destaque');
    ligaProxima(st);
  }
  // alguém parou em "Começar a Liga" com a Liga em andamento
  function ligaGatilho(st, g) {
    const L = st.liga; if (!L || st.vencedor != null) return;
    if (!L.ativos.includes(g)) return;
    if (L.etapa === 'duas') { const o = L.ativos.find(x => x !== g); L.fila.push([g, o, 'duas']); return ligaProxima(st); }
    if (L.etapa === 'tres') {
      const outros = L.ativos.filter(x => x !== g), v = L.venceu[g] || [];
      const o = v.length ? outros.find(x => !v.includes(x)) : outros[Math.floor(rnd(st) * outros.length)];
      log(st, `${J(st, g).nome} enfrenta ${J(st, o).nome}${v.length ? ' (o oponente que ainda não venceu)' : ' (sorteado)'}.`, 'destaque');
      L.fila.push([g, o, 'tres']); return ligaProxima(st);
    }
    if (L.etapa === 'semisEspera') { L.etapa = 'semis'; log(st, `${J(st, g).nome} parou em "Começar a Liga": começam as semifinais e ${J(st, g).nome} escolhe o oponente.`, 'destaque'); return pedirOponente(st, g, L.ativos.filter(x => x !== g), 'semis'); }
    if (L.etapa === 'final') log(st, 'A final já está marcada: os finalistas jogam 3 turnos cada e depois se enfrentam.');
  }
  function pedirOponente(st, quem, opcoes, fase) {
    st.pend = { tipo: 'ligaOponente', escolhe: quem, opcoes, fase, titulo: `Liga — ${FASE_LIGA[fase]}: ${J(st, quem).nome}, escolha seu oponente` };
  }
  function resolverLigaOponente(st, alvo) {
    const pd = st.pend; if (!pd || pd.tipo !== 'ligaOponente' || !pd.opcoes.includes(alvo)) return; const L = st.liga;
    const resto = pd.opcoes.filter(x => x !== alvo);
    L.fila.push([pd.escolhe, alvo, pd.fase]); if (resto.length === 2) L.fila.push([resto[0], resto[1], pd.fase]);
    log(st, `${J(st, pd.escolhe).nome} escolheu enfrentar ${J(st, alvo).nome}${resto.length === 2 ? `; ${J(st, resto[0]).nome} enfrenta ${J(st, resto[1]).nome}` : ''}.`, 'destaque');
    st.pend = null; ligaProxima(st); if (!st.pend) continuar(st);
  }
  function ligaProxima(st) {
    const L = st.liga; if (!L || st.vencedor != null) return;
    if (L.fila.length) { const [a, b, f] = L.fila.shift(); return novaBatalhaLiga(st, a, b, f); }
    if (L.etapa === 'r1') {
      L.etapa = 'semisEspera'; irPlanalto(st, L.ativos);
      log(st, `Classificados para as semifinais: ${L.ativos.map(id => J(st, id).nome).join(', ')}. Todos voltam ao Planalto Índigo; quem parar em "Começar a Liga" inicia as semifinais e escolhe o oponente.`, 'destaque');
    } else if (L.etapa === 'semis') {
      L.etapa = 'final'; L.finalTurnos = {}; L.ativos.forEach(id => L.finalTurnos[id] = 3); irPlanalto(st, L.ativos);
      log(st, `FINAL: ${L.ativos.map(id => J(st, id).nome).join(' × ')}. Os finalistas voltam ao Planalto Índigo, jogam 3 turnos cada e depois se enfrentam.`, 'destaque');
    }
  }
  function ligaAptos(st, pd, lado) { const q = J(st, pd[lado]); return q.pokemon.filter(id => obedece(q, P(id).cor) && !pd.mortos[lado].includes(id) && id !== pd.ativo[lado]); }
  function novaBatalhaLiga(st, a, b, fase) {
    const pd = { tipo: 'ligaBatalha', uid: (st.uid = (st.uid || 0) + 1), a, b, fase, titulo: `Liga — ${FASE_LIGA[fase]}: ${J(st, a).nome} × ${J(st, b).nome}`, ativo: { a: null, b: null }, mortos: { a: [], b: [] }, esc: { a: null, b: null }, duelos: [], resultado: null, vencLado: null, extra: false };
    st.pend = pd;
    log(st, `Batalha da Liga (${FASE_LIGA[fase]}): ${J(st, a).nome} × ${J(st, b).nome} — 3 contra 3.`, 'destaque');
    const sa = ligaAptos(st, pd, 'a').length, sb = ligaAptos(st, pd, 'b').length;
    if (!sa || !sb) { pd.vencLado = !sa && !sb ? (rnd(st) < 0.5 ? 'a' : 'b') : sa ? 'a' : 'b'; pd.wo = true; log(st, `${J(st, pd[pd.vencLado]).nome} vence por W.O. (o oponente não tem Pokémons que obedeçam).`); }
  }
  // cada lado escolhe em segredo: Pokémon (se não tiver um ativo) e, opcionalmente, um Item de batalha
  function ligaEscolher(st, lado, pokemon, item) {
    const pd = st.pend; if (!pd || pd.tipo !== 'ligaBatalha' || pd.resultado || pd.vencLado || !['a', 'b'].includes(lado) || pd.esc[lado]) return;
    const q = J(st, pd[lado]); let pk = (pd.forcado && pd.forcado[lado]) || pd.ativo[lado];
    if (!pk) { if (!ligaAptos(st, pd, lado).includes(pokemon)) return; pk = pokemon; }
    if (item && !(q.itens.includes(item) && ITEM(item).uso === 'batalha' && ITEM(item).bonus)) item = null;
    pd.esc[lado] = { pokemon: pk, item: item || null };
    if (pd.esc.a && pd.esc.b) ligaDuelo(st);
  }
  function ligaDuelo(st) {
    const pd = st.pend, ea = pd.esc.a, eb = pd.esc.b;
    pd.snap = { ativo: Object.assign({}, pd.ativo), mortos: { a: pd.mortos.a.slice(), b: pd.mortos.b.slice() }, extra: pd.extra };
    const r = duelo(st, { jogador: pd.a, pokemon: ea.pokemon, item: ea.item }, { jogador: pd.b, pokemon: eb.pokemon, item: eb.item }, null);
    pd.duelos.push({ pa: ea.pokemon, pb: eb.pokemon, ia: ea.item && ea.item.split('#')[0], ib: eb.item && eb.item.split('#')[0], fa: r.fa, fb: r.fb, da: r.da, db: r.db, venc: null });
    pd.esc = { a: null, b: null }; pd.forcado = null; pd.resultado = r; r.seq = st.log.length;
    aplicarDueloLiga(st, pd);
  }
  // aplica (ou reaplica, depois de um Pedido a Celebi) o resultado do último duelo a partir do estado anterior a ele
  function aplicarDueloLiga(st, pd) {
    const r = pd.resultado, d = pd.duelos[pd.duelos.length - 1], S = pd.snap;
    pd.ativo = Object.assign({}, S.ativo); pd.mortos = { a: S.mortos.a.slice(), b: S.mortos.b.slice() }; pd.extra = S.extra; pd.vencLado = null;
    const ea = { pokemon: d.pa }, eb = { pokemon: d.pb };
    const v = r.fa > r.fb ? 'a' : r.fb > r.fa ? 'b' : null; r.venc = v ? pd[v] : null;
    Object.assign(d, { fa: r.fa, fb: r.fb, da: r.da, db: r.db, venc: v });
    if (v === 'a') { pd.mortos.b.push(eb.pokemon); pd.ativo = { a: ea.pokemon, b: null }; }
    else if (v === 'b') { pd.mortos.a.push(ea.pokemon); pd.ativo = { a: null, b: eb.pokemon }; }
    else { pd.mortos.a.push(ea.pokemon); pd.mortos.b.push(eb.pokemon); pd.ativo = { a: null, b: null }; }
    const sorteio = () => { pd.vencLado = rnd(st) < 0.5 ? 'a' : 'b'; log(st, `Nenhum dos dois tem mais Pokémons: o sorteio dá a vitória a ${J(st, pd[pd.vencLado]).nome}.`); };
    const desempate = (msg) => { // os dois lados ficaram sem Pokémons ao mesmo tempo (empate): duelo extra
      const ha = ligaAptos(st, pd, 'a').length, hb = ligaAptos(st, pd, 'b').length; pd.extra = true;
      if (!ha && !hb) sorteio(); else if (!ha) pd.vencLado = 'b'; else if (!hb) pd.vencLado = 'a'; else log(st, msg, 'destaque');
    };
    if (pd.extra) { if (v) pd.vencLado = v; else desempate('Novo empate no duelo extra: mais um duelo com o próximo Pokémon!'); }
    else {
      const fora = l => !pd.ativo[l] && (pd.mortos[l].length >= 3 || !ligaAptos(st, pd, l).length);
      const fa = fora('a'), fb = fora('b');
      if (fa && fb) desempate('Empate com os Pokémons dos dois lados derrotados: duelo extra com um 4º Pokémon!');
      else if (fa) pd.vencLado = 'b'; else if (fb) pd.vencLado = 'a';
    }
  }
  // Pedido a Celebi na Liga: quem luta pode refazer o próprio dado ou o do adversário (que pode bloquear com Poké-Boneca)
  function ligaCelebi(st, quem, lado) {
    const pd = st.pend; if (!pd || pd.tipo !== 'ligaBatalha' || !pd.resultado || !['a', 'b'].includes(quem) || !['a', 'b'].includes(lado)) return;
    const p = J(st, pd[quem]); if (!celebiDe(p)) return; gastarCelebi(st, p);
    const dono = J(st, pd[lado]);
    log(st, `${p.nome} usou Pedido a Celebi no dado de ${dono.id === p.id ? 'si mesmo' : dono.nome}.`, 'destaque', [['it', 'pedidocelebi']]);
    if (dono.id !== p.id && temBoneca(dono)) { st.pend = { tipo: 'boneca', acao: 'Pedido a Celebi', alvo: dono.id, atacante: p.id, respondente: dono.id, bloqueado: false, liga: pd, lado, titulo: `${dono.nome}: usar Poké-Boneca contra o Pedido a Celebi?` }; return; }
    rerolarLadoLiga(st, pd, lado);
  }
  function rerolarLadoLiga(st, pd, lado) {
    const r = pd.resultado, nd = dado(st), antes = lado === 'a' ? r.da : r.db; silver(st, J(st, pd[lado]), [nd]);
    if (lado === 'a') r.da = nd; else r.db = nd;
    r.fa = r.det.a.forca + r.da; r.fb = r.det.b.forca + r.db; r.celebi = (r.celebi || 0) + 1; r.seq = st.log.length + 1000 * r.celebi;
    aplicarDueloLiga(st, pd);
    log(st, `Dado refeito (${antes} → ${nd}): ${J(st, pd.a).nome} ${r.fa} × ${r.fb} ${J(st, pd.b).nome} — ${r.venc == null ? 'empate' : J(st, r.venc).nome + ' vence o duelo'}.`, 'destaque');
  }
  // Remédio na Liga: o Pokémon nocauteado no último duelo volta e o duelo é refeito com os mesmos Pokémons
  function ligaRemedio(st, lado) {
    const pd = st.pend; if (!pd || pd.tipo !== 'ligaBatalha' || !pd.resultado || !['a', 'b'].includes(lado)) return;
    const d = pd.duelos[pd.duelos.length - 1], q = J(st, pd[lado]); if (!d || d.venc === lado) return;
    const pot = q.itens.find(i => i.split('#')[0] === 'potion'); if (!pot) return;
    descartarItem(st, q, pot);
    const S = pd.snap; pd.ativo = Object.assign({}, S.ativo); pd.mortos = { a: S.mortos.a.slice(), b: S.mortos.b.slice() }; pd.extra = S.extra;
    pd.duelos.pop(); pd.resultado = null; pd.vencLado = null; pd.esc = { a: null, b: null }; pd.forcado = { a: d.pa, b: d.pb };
    log(st, `${q.nome} usou Remédio: ${P(lado === 'a' ? d.pa : d.pb).nome} volta e o duelo é refeito (${P(d.pa).nome} × ${P(d.pb).nome}).`, 'destaque', [['it', 'potion']]);
  }
  // depois de ver o resultado de um duelo
  function ligaSeguir(st) {
    const pd = st.pend; if (!pd || pd.tipo !== 'ligaBatalha') return;
    pd.resultado = null; if (pd.vencLado) ligaFimBatalha(st);
  }
  function ligaFimBatalha(st) {
    const pd = st.pend, L = st.liga, w = pd[pd.vencLado], l = pd[pd.vencLado === 'a' ? 'b' : 'a'], W = J(st, w);
    L.hist.push({ fase: pd.fase, a: pd.a, b: pd.b, venc: w, duelos: pd.duelos, wo: !!pd.wo });
    contaBatalha(st, 'liga', [pd.a, pd.b], w);
    log(st, `🏆 ${W.nome} vence ${J(st, l).nome} na Liga (${FASE_LIGA[pd.fase]}).`, 'destaque');
    st.pend = null;
    const elim = id => { J(st, id).eliminado = true; L.ativos = L.ativos.filter(x => x !== id); L.elim.push(id); log(st, `${J(st, id).nome} foi eliminado da Liga.`); devolverEliminado(st, J(st, id)); };
    let campeao = null;
    if (pd.fase === 'duas') { L.vit[w] = (L.vit[w] || 0) + 1; if (L.vit[w] >= 2) campeao = w; else { irPlanalto(st, [w, l]); log(st, `Placar: ${L.ativos.map(id => J(st, id).nome + ' ' + (L.vit[id] || 0)).join(' × ')}. Os dois voltam ao Planalto Índigo.`); } }
    else if (pd.fase === 'tres') { const v = L.venceu[w] = L.venceu[w] || []; if (!v.includes(l)) v.push(l); if (v.length >= 2) campeao = w; else { irPlanalto(st, [w, l]); log(st, 'Os dois voltam ao Planalto Índigo.'); } }
    else if (pd.fase === 'r1a') { L.perdedores.push(l); if (L.perdedores.length === 2) { L.fila.push([L.perdedores[0], L.perdedores[1], 'r1b']); log(st, `Repescagem: ${J(st, L.perdedores[0]).nome} × ${J(st, L.perdedores[1]).nome}; quem vencer também vai às semifinais.`); } }
    else if (pd.fase === 'final') { elim(l); campeao = w; }
    else elim(l); // r1, r1b, semis
    if (campeao != null) return coroar(st, campeao);
    log(st, `${W.nome} compra 3 Itens pela vitória na Liga.`);
    st.fila = [['ligaProx']].concat(st.fila || []);
    ganharItens(st, W, 3);
    continuar(st);
  }
  function coroar(st, id) {
    const q = J(st, id); st.vencedor = id; st.fila = []; st.fase = 'fim'; if (st.liga) st.liga.etapa = 'fim';
    log(st, `👑 ${q.nome} é o novo Mestre Pokémon e vence o jogo!`, 'destaque');
    st.pend = { tipo: 'campeao', jogador: id, titulo: `${q.nome} é o novo Mestre Pokémon!` };
  }

  // ---------- fim de turno ----------
  function podeEncerrar(st) { return st.vencedor == null && st.fase !== 'mover' && !st.pend && !(st.fila && st.fila.length); }
  function encerrarTurno(st) {
    const p = J(st); if (!podeEncerrar(st)) return;
    if (p.itens.length > limiteItens(p)) { st.pend = { tipo: 'descartar', n: p.itens.length - limiteItens(p), titulo: `Descarte ${p.itens.length - limiteItens(p)} Item(ns) (limite ${limiteItens(p)})` }; return; }
    if (st.turno.turnoExtra) { st.turno.turnoExtra = false; log(st, `${p.nome} joga um turno extra.`); st.turno = null; inicioTurno(st, true); return; }
    if (st.turno.bicicletaAtiva) { st.turno.bicicletaAtiva = false; log(st, `${p.nome} joga o turno extra (Bicicleta).`); st.turno = null; inicioTurno(st, true); st.turno.bicicletaUsada = true; return; }
    proximo(st);
  }
  function descartarExcesso(st, insts) {
    const pd = st.pend; if (!pd || pd.tipo !== 'descartar' || insts.length !== pd.n) return; const p = J(st);
    insts.forEach(i => descartarItem(st, p, i)); st.pend = null; log(st, `${p.nome} descartou ${insts.length} Item(ns).`); encerrarTurno(st);
  }
  function usarItem(st, inst) {
    // usos genéricos fora de captura/batalha
    const p = J(st), it = ITEM(inst); if (!it) return;
    if (it.id === 'bike1') { if (st.turno.bicicletaUsada) { log(st, 'Não é possível usar duas Bicicletas em sequência.'); return; } st.turno.bicicletaAtiva = true; descartarItem(st, p, inst); log(st, `${p.nome} usou Bicicleta: terá um turno extra.`, '', [['it', it.id]]); return; }
    if (it.id === 'corda' || it.id === 'escaperope') return; // tratado no movimento
    const turnoLivre = st.fase === 'inicio' && !st.pend;
    if (it.id === 'doceraro') {
      const f = { aberta: true, cores: ['rosa', 'verde', 'azul', 'inicial'], familias: [...new Set(p.pokemon.map(id => P(id).familia).filter(Boolean))], acao: 'pegar', titulo: 'Doce Raro: pegue um Pokémon revelado (Azul ou mais fraco) da linha evolutiva de um dos seus' };
      if (st.pend || !filtrarSlots(st, f).length) { log(st, 'Doce Raro: não há Pokémon revelado da linha evolutiva dos seus (Azul ou mais fraco).'); return; }
      descartarItem(st, p, inst); log(st, `${p.nome} usou Doce Raro.`, '', [['it', it.id]]); slotSel(st, f); return;
    }
    if (it.id === 'potedemel') {
      const f = { hex: true, acao: 'capturar', titulo: 'Pote de Mel: escolha um Pokémon deste hexágono para tentar capturar' };
      if (st.pend || !filtrarSlots(st, f).length) { log(st, 'Pote de Mel: não há Pokémon neste hexágono.'); return; }
      descartarItem(st, p, inst); log(st, `${p.nome} usou Pote de Mel.`, '', [['it', it.id]]); slotSel(st, f); return;
    }
    if (it.id === 'truquerocket') {
      if (st.pend || !alvosValidos(st, 'roubar1', {}).length) { log(st, 'Truque Rocket: nenhum oponente tem Itens.'); return; }
      descartarItem(st, p, inst); log(st, `${p.nome} usou Truque Rocket.`, '', [['it', it.id]]); pedirAlvo(st, 'roubar1', { bloqueavel: true }); return;
    }
    if (it.id === 'vara') {
      if (!turnoLivre) { log(st, 'A Vara de Pesca só pode ser usada antes de se deslocar.'); return; }
      descartarItem(st, p, inst); log(st, `${p.nome} usou Vara de Pesca (não se move neste turno).`, '', [['it', it.id]]);
      st.fase = 'acao'; st.turno.moveu = true;
      st.pend = { tipo: 'espaco', opcoes: [p.pos, ...adjacentes(st, p.pos)], ativar: true, sóAtivar: true, titulo: 'Vara de Pesca: escolha o espaço a ativar (o seu ou um vizinho)' }; return;
    }
    if (it.id === 'voar') {
      if (!turnoLivre) { log(st, 'Voar deve ser a única ação do turno: use antes de rolar o dado.'); return; }
      descartarItem(st, p, inst); log(st, `${p.nome} usou Voar.`, '', [['it', it.id]]);
      st.fase = 'acao'; st.turno.moveu = true; st.turno.voou = true; pedirEspaco(st, { ativar: true, titulo: 'Voar: escolha qualquer espaço deste hexágono' }); return;
    }
    if (it.id === 'lura') {
      if (st.pend || !luraOpcoes(st).length) { log(st, 'Módulo de Lura: não há dois Pokémons da mesma cor (com pelo menos um revelado) para trocar.'); return; }
      descartarItem(st, p, inst); log(st, `${p.nome} usou Módulo de Lura.`, '', [['it', it.id]]);
      st.pend = { tipo: 'lura', primeiro: null, opcoes: luraOpcoes(st), titulo: 'Módulo de Lura: escolha o primeiro Pokémon' }; return;
    }
    if (it.id === 'pokenavplus') { if (st.pend) return; descartarItem(st, p, inst); log(st, `${p.nome} usou PokéNav Plus.`, '', [['it', it.id]]); pedirAlvo(st, 'navPlus', { bloqueavel: true, incluirEu: true }); return; }
    descartarItem(st, p, inst); log(st, `${p.nome} usou ${it.nome}. (efeito aplicado manualmente)`, '', [['it', it.id]]);
  }
  function lyra(st) { const p = J(st); if (st.fase !== 'inicio') return; comprarItem(st, p, 2); log(st, `${p.nome} pula o turno (Lyra) e compra 2 Itens.`); st.fase = 'acao'; }

  // ---------- caixa de ferramentas (efeitos manuais) ----------
  function ferramenta(st, op, a) {
    a = a || {}; const p = J(st, a.jogador);
    switch (op) {
      case 'item': comprarItem(st, p, a.n || 1); break;
      case 'treinador': comprarTreinador(st, p, a.n || 1); break;
      case 'evento': comprarEvento(st, 'evento'); break;
      case 'superevento': comprarEvento(st, 'superevento'); break;
      case 'ganhar': ganharCor(st, p, a.cor, a.n || 1); break;
      case 'capturar': { const c = tirar(st, a.cor); if (c) iniciarCaptura(st, { carta: c, cor: a.cor }); break; }
      case 'capturarSlot': { const s = st.slots[a.slot]; if (s && s.carta) { revelar(st, a.slot); iniciarCaptura(st, { slot: a.slot }); } break; }
      case 'pegarSlot': { const s = st.slots[a.slot]; if (s && s.carta) { const id = s.carta; st.slots[a.slot] = { carta: tirar(st, grafo(st).slots[a.slot].cor), aberta: false, fraco: false }; ganharPokemon(st, p, id, 'de graça'); } break; }
      case 'revelar': revelar(st, a.slot); break;
      case 'pular': p.pular += a.n || 1; log(st, `${p.nome} perderá ${a.n || 1} turno(s).`); break;
      case 'descartarItem': descartarItem(st, p, a.inst); log(st, `${p.nome} descartou ${ITEM(a.inst).nome}.`); break;
      case 'darItem': { const q = J(st, a.para); const i = p.itens.indexOf(a.inst); if (i >= 0) { p.itens.splice(i, 1); q.itens.push(a.inst); log(st, `${p.nome} deu ${ITEM(a.inst).nome} para ${q.nome}.`); } break; }
      case 'roubarItem': { const q = J(st, a.de); if (q.itens.length) { const i = Math.floor(rnd(st) * q.itens.length); const inst = q.itens.splice(i, 1)[0]; p.itens.push(inst); log(st, `${p.nome} pegou um Item aleatório de ${q.nome}.`); } break; }
      case 'mover': p.pos = a.espaco; addU(p.passou, a.espaco); log(st, `${p.nome} foi movido para ${nomeEspaco(st, a.espaco)}.`); if (a.ativar) chegar(st, a.espaco); break;
      case 'trocar': { const q = J(st, a.com); const i = p.pokemon.indexOf(a.meu), j = q.pokemon.indexOf(a.dele); if (i < 0 || j < 0) break; p.pokemon[i] = a.dele; q.pokemon[j] = a.meu; log(st, `${p.nome} trocou ${P(a.meu).nome} por ${P(a.dele).nome} de ${q.nome}.`); break; }
      case 'removerPokemon': { const i = p.pokemon.indexOf(a.id); if (i >= 0) { p.pokemon.splice(i, 1); delete p.mais1[a.id]; devolver(st, P(a.id).cor, a.id); log(st, `${p.nome} devolveu ${P(a.id).nome}.`); } break; }
      case 'trocarTreinadores': { const q = J(st, a.com); [p.treinador, q.treinador] = [q.treinador, p.treinador]; log(st, `${p.nome} e ${q.nome} trocaram de Treinador.`); break; }
      case 'mais1': p.mais1[a.id] = (p.mais1[a.id] || 0) + 1; log(st, `${P(a.id).nome} recebe +1 permanente.`); break;
      case 'travar': st.pend = { tipo: 'travar', jogador: p.id, titulo: 'Trave e melhore (+1) uma família' }; break;
    }
    continuar(st);
  }
  // ---------- batalha livre (Duelos, Liga) ----------
  function forcaEmBatalha(st, pi, id, inst, oponenteTipos, mods) {
    const p = J(st, pi), c = P(id); let f = forcaBase(p, id) + bonusTreinador(p, id) + (inst ? bonusItemBatalha(inst, id) : 0) + vantagem(c.vantagens, oponenteTipos || []);
    if (mods) { if (c.tipos.some(t => (mods.mais1 || []).includes(t))) f += 1; if (c.tipos.some(t => (mods.menos1 || []).includes(t))) f -= 1; }
    return f;
  }
  function detalheBatalha(st, pi, id, inst, opTipos, mods) {
    const p = J(st, pi), c = P(id);
    const d = { pokemon: id, base: P(id).forca, evol: bonusEvolucao(p, id) + bonusTravada(p, id), trein: bonusTreinador(p, id), vant: vantagem(c.vantagens, opTipos || []), item: inst ? bonusItemBatalha(inst, id) : 0, itemId: inst ? inst.split('#')[0] : null, local: 0 };
    if (mods) { if (c.tipos.some(t => (mods.mais1 || []).includes(t))) d.local += 1; if (c.tipos.some(t => (mods.menos1 || []).includes(t))) d.local -= 1; }
    d.forca = d.base + d.evol + d.trein + d.vant + d.item + d.local; return d;
  }
  function duelo(st, a, b, mods) {
    // a/b: {jogador, pokemon, item}
    const da = dado(st), db = dado(st); silver(st, J(st, a.jogador), [da]); silver(st, J(st, b.jogador), [db]);
    const fa = forcaEmBatalha(st, a.jogador, a.pokemon, a.item, P(b.pokemon).tipos, mods) + da;
    const fb = forcaEmBatalha(st, b.jogador, b.pokemon, b.item, P(a.pokemon).tipos, mods) + db;
    [a, b].forEach(x => { if (x.item) descartarItem(st, J(st, x.jogador), x.item); });
    const r = { da, db, fa, fb, venc: fa > fb ? a.jogador : fb > fa ? b.jogador : null,
      det: { a: detalheBatalha(st, a.jogador, a.pokemon, a.item, P(b.pokemon).tipos, mods), b: detalheBatalha(st, b.jogador, b.pokemon, b.item, P(a.pokemon).tipos, mods) }, seq: (st.log.length) };
    log(st, `Duelo: ${J(st, a.jogador).nome} (${P(a.pokemon).nome}) ${fa} × ${fb} ${J(st, b.jogador).nome} (${P(b.pokemon).nome}) — ${r.venc == null ? 'empate, ambos desmaiam' : J(st, r.venc).nome + ' vence'}.`, 'destaque');
    return r;
  }

  // ---------- Grupo 1: efeitos com alvo (oponente) ----------
  const BONECA = 'pokedollblock';
  const temBoneca = p => p.itens.find(i => i.split('#')[0] === BONECA);
  const ACAO_NOME = { praca: 'Festival de Praça', impostor: 'Prof. Impostor', pokefans: 'Poké-Fans', esconderijo: 'Esconderijo Rocket', roubar1: 'roubo de Item', roubar2: 'roubo de 2 Itens', dar2: 'Sr. Fuji (2 Itens)', navTr: 'Pokénav Melhorado', navPlus: 'PokéNav Plus', juniper: 'Prof. Juniper', eventoPara: 'Evento para um oponente', eventoCarta: 'Evento para um oponente', dar1: 'Sr. Fuji (1 Item)', pular2: 'Operação Galactic (perder 2 turnos)', pular1: 'Operação Galactic (perder 1 turno)', troca: 'Troca Pokémon', ssanne: 'S.S. Anne', copycat2: 'Copycat', duelo: 'Duelo' };
  function podeTrocar(p, id) { return !familiaTravada(p, id); }
  function paresTroca(p, q, cores) {
    const out = [];
    p.pokemon.filter(id => podeTrocar(p, id) && (!cores || cores.includes(P(id).cor))).forEach(a => q.pokemon.filter(id => podeTrocar(q, id) && P(id).cor === P(a).cor).forEach(b => out.push([a, b])));
    return out;
  }
  function alvosValidos(st, acao, o) {
    const eu = J(st), usados = (st.turno && st.turno.alvosUsados) || [];
    return st.jogadores.filter(q => !q.eliminado && (q.id !== eu.id || (o && o.incluirEu)) && !(o && o.distinto && usados.includes(q.id))).filter(q => {
      if (acao === 'troca' || acao === 'ssanne') return paresTroca(eu, q, o && o.cores).length > 0;
      if (acao === 'roubar1' || acao === 'roubar2') return q.itens.length > 0;
      if (acao === 'duelo') return q.pokemon.some(id => obedece(q, P(id).cor)) && eu.pokemon.some(id => obedece(eu, P(id).cor));
      if (acao === 'praca') return pracaAptosDe(q).length > 0 && pracaAptosDe(eu).length > 0;
      return true;
    }).map(q => q.id);
  }
  function pedirAlvo(st, acao, o) {
    o = o || {}; const ops = alvosValidos(st, acao, o);
    if (!ops.length) { log(st, `Nenhum oponente válido para ${ACAO_NOME[acao] || acao}.`); return; }
    st.pend = { tipo: 'alvo', acao, opcoes: ops, bloqueavel: o.bloqueavel !== false, mods: o.mods || null, premio: o.premio || null, cores: o.cores || null, carta: o.carta || null, titulo: `${ACAO_NOME[acao] || acao}: escolha ${o.incluirEu ? 'o jogador (pode ser você)' : 'o oponente'}` };
  }
  function escolherAlvo(st, alvo) {
    const pd = st.pend; if (!pd || pd.tipo !== 'alvo' || !pd.opcoes.includes(alvo)) return;
    if (st.turno) (st.turno.alvosUsados = st.turno.alvosUsados || []).push(alvo);
    const q = J(st, alvo);
    if (pd.bloqueavel && temBoneca(q) && q.id !== atv(st)) { st.pend = { tipo: 'boneca', acao: pd.acao, alvo, mods: pd.mods, premio: pd.premio, respondente: alvo, bloqueado: false, cores: pd.cores, carta: pd.carta, titulo: `${q.nome}: usar Poké-Boneca contra ${ACAO_NOME[pd.acao] || pd.acao}?` }; return; }
    st.pend = null; aplicarAcao(st, pd.acao, alvo, pd); continuar(st);
  }
  function responderBoneca(st, usar) {
    const pd = st.pend; if (!pd || pd.tipo !== 'boneca') return;
    const resp = J(st, pd.respondente);
    if (usar) {
      const inst = temBoneca(resp); if (!inst) return; descartarItem(st, resp, inst);
      pd.bloqueado = !pd.bloqueado;
      log(st, `${resp.nome} usou Poké-Boneca${pd.bloqueado ? ' e bloqueou o efeito' : ' e anulou a Boneca do oponente'}!`, 'destaque');
      const outro = J(st, pd.respondente === pd.alvo ? (pd.atacante != null ? pd.atacante : atv(st)) : pd.alvo);
      if (temBoneca(outro)) { pd.respondente = outro.id; pd.titulo = `${outro.nome}: usar Poké-Boneca para anular a do oponente?`; return; }
    }
    if (pd.praca) { st.pend = pd.praca; if (pd.bloqueado) log(st, `${J(st, pd.alvo).nome} bloqueou o Pedido a Celebi.`); else rerolarLadoPraca(st, pd.praca, pd.lado); return; }
    if (pd.liga) { st.pend = pd.liga; if (pd.bloqueado) log(st, `${J(st, pd.alvo).nome} bloqueou o Pedido a Celebi.`); else rerolarLadoLiga(st, pd.liga, pd.lado); return; }
    if (pd.duelo) { st.pend = pd.duelo; if (pd.bloqueado) log(st, `${J(st, pd.alvo).nome} bloqueou o Pedido a Celebi.`); else rerolarLadoDuelo(st, pd.duelo, pd.lado); return; }
    st.pend = null;
    if (pd.modo === 'todos') { if (pd.bloqueado) { pd.ctx.protegidos.push(pd.alvo); log(st, `${J(st, pd.alvo).nome} se protegeu de ${pd.acao}.`); } proximoTodos(st, pd.ctx); continuar(st); return; }
    if (pd.bloqueado) log(st, `${ACAO_NOME[pd.acao] || pd.acao} foi bloqueado.`);
    else aplicarAcao(st, pd.acao, pd.alvo, pd);
    continuar(st);
  }
  function roubar(st, p, q, n) {
    let k = 0; for (; k < n && q.itens.length; k++) { const i = Math.floor(rnd(st) * q.itens.length); p.itens.push(q.itens.splice(i, 1)[0]); }
    log(st, `${p.nome} pegou ${k} Item(ns) aleatório(s) de ${q.nome}.`);
  }
  function aplicarAcao(st, acao, alvo, pd) {
    const p = J(st), q = J(st, alvo);
    switch (acao) {
      case 'impostor':
        [p, q].forEach(x => { x.itens.slice().forEach(i => descartarItem(st, x, i)); });
        comprarItem(st, p, 2); comprarItem(st, q, 2); log(st, `${p.nome} e ${q.nome} descartaram seus Itens e compraram 2.`); break;
      case 'pokefans':
        if (st.trocasCarta && (p.treinador || q.treinador)) st.trocasCarta.push({ tr: true, a: p.id, b: q.id, pa: p.treinador, pb: q.treinador });
        [p.treinador, q.treinador] = [q.treinador, p.treinador]; comprarItem(st, p, 2); comprarItem(st, q, 2);
        log(st, `${p.nome} e ${q.nome} trocaram de Treinador e compraram 2 Itens.`); break;
      case 'esconderijo':
        [p, q].forEach(x => { const velho = x.treinador; if (x.treinador) st.descartes.treinador.push(x.treinador); reporBaralho(st, 'treinador'); x.treinador = st.decks.treinador.shift() || null; if (st.trocasCarta && x.treinador) st.trocasCarta.push({ tr: true, j: x.id, saiu: velho, entrou: x.treinador }); });
        log(st, `${p.nome} e ${q.nome} trocaram de Treinador por um novo do baralho.`); break;
      case 'roubar1': roubar(st, p, q, 1); break;
      case 'roubar2': roubar(st, p, q, 2); break;
      case 'troca': case 'ssanne': st.pend = { tipo: 'troca', com: alvo, ssanne: acao === 'ssanne', cores: pd.cores || null, titulo: `Troca com ${q.nome}: escolha um Pokémon seu e um dele, da mesma cor${pd.cores ? ' (' + pd.cores.join(' ou ') + ')' : ''}` }; break;
      case 'eventoPara': st.fila.unshift(['comoJogador', alvo, [['evento']]]); log(st, `${q.nome} compra e ativa um Evento.`); break;
      case 'eventoCarta': st.fila.unshift(['comoJogador', alvo, [['cartaPronta', pd.carta]]]); log(st, `${q.nome} ativa o Evento "${idx().ev[pd.carta].nome}".`, '', [['ev', pd.carta]]); break;
      case 'juniper':
        if (!p.itens.length) { log(st, `${p.nome} não tem Itens para dar.`); st.fila.unshift(['juniperFim', alvo]); break; }
        st.pend = { tipo: 'juniper', etapa: 1, doador: p.id, receptor: alvo, alvo, titulo: `Prof. Juniper: ${p.nome}, escolha um Item para dar a ${q.nome}` }; break;
      case 'navPlus':
        if (q.treinador) st.descartes.treinador.push(q.treinador); q.treinador = null;
        log(st, `${q.nome} descartou o Treinador e compra 2 novos para escolher um.`);
        comprarTreinador(st, q, 2); break;
      case 'navTr': if (q.treinador) st.descartes.treinador.push(q.treinador); reporBaralho(st, 'treinador'); q.treinador = st.decks.treinador.shift() || null; log(st, `${q.nome} descartou o Treinador e comprou outro.`); break;
      case 'dar2': comprarItem(st, q, 2); break;
      case 'dar1': comprarItem(st, q, 1); break;
      case 'pular2': q.pular += 2; log(st, `${q.nome} perde os próximos 2 turnos.`); break;
      case 'pular1': q.pular += 1; log(st, `${q.nome} perde o próximo turno.`); break;
      case 'copycat2': {
        comprarItem(st, p, 1); comprarItem(st, q, 1);
        if (noHexFinal(st, p) || noHexFinal(st, q)) { log(st, `${p.nome} e ${q.nome} compraram 1 Item; não trocam de lugar porque ${noHexFinal(st, p) ? p.nome : q.nome} está no hexágono do Planalto Índigo.`); break; }
        [p.pos, q.pos] = [q.pos, p.pos];
        log(st, `${p.nome} e ${q.nome} compraram 1 Item e trocaram de lugar.`); break;
      }
      case 'praca': iniciarPraca(st, p.id, alvo); break;
      case 'duelo': st.pend = { tipo: 'duelo', a: p.id, b: alvo, mods: pd.mods, premio: pd.premio, fora: [], escolhas: {}, resultado: null, titulo: 'Duelo: ' + p.nome + ' × ' + q.nome }; break;
    }
  }
  function resolverTroca(st, meu, dele) {
    const pd = st.pend; if (!pd || pd.tipo !== 'troca') return; const p = J(st), q = J(st, pd.com);
    if (!paresTroca(p, q, pd.cores).some(([a, b]) => a === meu && b === dele)) return;
    p.pokemon[p.pokemon.indexOf(meu)] = dele; q.pokemon[q.pokemon.indexOf(dele)] = meu;
    moverMais1(p, q, meu); moverMais1(q, p, dele);
    if (st.trocasCarta) st.trocasCarta.push({ a: p.id, b: q.id, pa: meu, pb: dele });
    log(st, `${p.nome} trocou ${P(meu).nome} por ${P(dele).nome} de ${q.nome}.`, 'destaque');
    if (pd.ssanne) comprarItem(st, q, 2);
    st.pend = null; continuar(st);
  }
  // Copycat / DJ Mary: compre 2, fique com 1 e dê o outro ao próximo jogador
  function resolverDividir(st, manter) {
    const pd = st.pend; if (!pd || pd.tipo !== 'dividir' || !pd.itens.includes(manter)) return;
    const p = J(st), prox = J(st, (atv(st) + 1) % st.jogadores.length), outro = pd.itens.find(i => i !== manter);
    p.itens.push(manter); if (outro) prox.itens.push(outro);
    log(st, `${p.nome} ficou com ${ITEM(manter).nome}${outro ? ` e deu ${ITEM(outro).nome} para ${prox.nome}` : ''}.`);
    st.pend = null; continuar(st);
  }
  // Operação Rocket: duas opções
  function escolherOpcao(st, k) {
    const pd = st.pend; if (!pd || pd.tipo !== 'opcao' || !pd.opcoes[k]) return;
    st.pend = null; st.fila = pd.opcoes[k].passos.concat(st.fila || []); continuar(st);
  }
  // Duelo: cada lado escolhe Pokémon (e item); empate → ambos desmaiam e escolhem de novo
  function aptosDuelo(st, pd, lado) { const q = J(st, pd[lado]); return q.pokemon.filter(id => obedece(q, P(id).cor) && !pd.fora.includes(lado + ':' + id)); }
  // escolha de um lado do Duelo (cada jogador escolhe o seu, em segredo); quando os dois escolheram, o duelo acontece
  function escolherDuelo(st, lado, e) {
    const pd = st.pend; if (!pd || pd.tipo !== 'duelo' || !['a', 'b'].includes(lado) || !e || (pd.resultado && (pd.resultado.venc != null || pd.resultado.fim))) return;
    if (!aptosDuelo(st, pd, lado).includes(e.pokemon)) return;
    const q = J(st, pd[lado]); const item = e.item && q.itens.includes(e.item) && ITEM(e.item).uso === 'batalha' ? e.item : null;
    pd.escolhas = pd.escolhas || {}; pd.escolhas[lado] = { pokemon: e.pokemon, item };
    if (pd.escolhas.a && pd.escolhas.b) { const { a, b } = pd.escolhas; pd.escolhas = {}; lutarDuelo(st, a, b); }
  }
  function lutarDuelo(st, ea, eb) {
    const pd = st.pend; if (!pd || pd.tipo !== 'duelo' || pd.resultado && pd.resultado.venc != null) return;
    if (!aptosDuelo(st, pd, 'a').includes(ea.pokemon) || !aptosDuelo(st, pd, 'b').includes(eb.pokemon)) return;
    const r = duelo(st, { jogador: pd.a, pokemon: ea.pokemon, item: ea.item || null }, { jogador: pd.b, pokemon: eb.pokemon, item: eb.item || null }, pd.mods);
    pd.resultado = r;
    if (r.venc == null) {
      pd.fora.push('a:' + ea.pokemon, 'b:' + eb.pokemon); r.empateFora = ['a:' + ea.pokemon, 'b:' + eb.pokemon];
      const ra = aptosDuelo(st, pd, 'a').length, rb = aptosDuelo(st, pd, 'b').length;
      if (!ra && !rb) { log(st, 'Ninguém tem mais Pokémons: duelo sem vencedor.'); pd.resultado.fim = true; }
      else if (!ra || !rb) { r.venc = ra ? pd.a : pd.b; log(st, `${J(st, r.venc).nome} vence o duelo (o oponente ficou sem Pokémons).`, 'destaque'); }
    }
  }
  function recalcDuelo(st, pd) {
    const r = pd.resultado; r.fa = r.det.a.forca + r.da; r.fb = r.det.b.forca + r.db;
    if (r.empateFora) { pd.fora = pd.fora.filter(x => !r.empateFora.includes(x)); r.empateFora = null; }
    r.fim = false; r.venc = r.fa > r.fb ? pd.a : r.fb > r.fa ? pd.b : null;
    if (r.venc == null) {
      r.empateFora = ['a:' + r.det.a.pokemon, 'b:' + r.det.b.pokemon]; pd.fora.push(...r.empateFora);
      const ra = aptosDuelo(st, pd, 'a').length, rb = aptosDuelo(st, pd, 'b').length;
      if (!ra && !rb) r.fim = true; else if (!ra || !rb) r.venc = ra ? pd.a : pd.b;
    }
    r.seq = st.log.length + 1000 * (r.celebi || 0);
    log(st, `Duelo refeito: ${J(st, pd.a).nome} ${r.fa} × ${r.fb} ${J(st, pd.b).nome} — ${r.venc == null ? (r.fim ? 'sem vencedor' : 'empate, ambos desmaiam') : J(st, r.venc).nome + ' vence'}.`, 'destaque');
  }
  function celebiDuelo(st, lado) {
    const pd = st.pend, p = J(st); if (!pd || pd.tipo !== 'duelo' || !pd.resultado || !pd.resultado.det || !celebiDe(p) || !['a', 'b'].includes(lado)) return;
    const r = pd.resultado; gastarCelebi(st, p); r.celebi = (r.celebi || 0) + 1;
    const dono = J(st, pd[lado]);
    log(st, `${p.nome} usou Pedido a Celebi no dado de ${dono.id === p.id ? 'si mesmo' : dono.nome}.`, 'destaque', [['it', 'pedidocelebi']]);
    if (dono.id !== p.id && temBoneca(dono)) { st.pend = { tipo: 'boneca', acao: 'Pedido a Celebi', alvo: dono.id, respondente: dono.id, bloqueado: false, duelo: pd, lado, titulo: `${dono.nome}: usar Poké-Boneca contra o Pedido a Celebi?` }; return; }
    rerolarLadoDuelo(st, pd, lado);
  }
  function rerolarLadoDuelo(st, pd, lado) {
    const r = pd.resultado, nd = dado(st); silver(st, J(st, pd[lado]), [nd]);
    if (lado === 'a') r.da = nd; else r.db = nd; recalcDuelo(st, pd);
  }
  function premiarDuelo(st, w, premio) {
    if (!premio) return;
    if (premio === 'dojo') ganharCor(st, w, 'azul', 1);
    else if (premio === 'estufa') ganharCor(st, w, 'verde', 2);
    else if (premio === 'vulcao') { ganharItens(st, w, 3); st.fila.unshift(['treinadorDe', w.id]); }
    else if (premio === 'gelo') {
      log(st, `Prêmio da Arena de Gelo: ${w.nome} escolhe e ativa um entre os 2 próximos Eventos.`, 'destaque');
      st.fila.unshift(['comoJogador', w.id, [['especialE', 'compre_2_eventos']]]);
    }
  }
  function fecharDuelo(st) { const pd = st.pend; if (!pd || pd.tipo !== 'duelo') return; if (pd.resultado && pd.resultado.det) contaBatalha(st, 'duelo', [pd.a, pd.b], pd.resultado.venc); const r = pd.resultado; st.pend = null; if (r && r.venc != null) premiarDuelo(st, J(st, r.venc), pd.premio); continuar(st); }

  // ---------- Grupo 2: efeitos para todos / por regra ----------
  const TODOS_NOME = { aqua: 'Invasão Aqua', magma: 'Invasão Magma', rocket: 'Invasão Rocket', opaqua: 'Operação Aqua', opmagma: 'Operação Magma' };
  function iniciarTodos(st, acao) {
    if (acao === 'rocket') { st.jogadores.filter(q => !q.eliminado).forEach(q => comprarItem(st, q, 1, true)); log(st, 'Todos compraram um Item.'); }
    const ordem = st.jogadores.map((_, k) => (atv(st) + 1 + k) % st.jogadores.length).filter(i => i !== atv(st) && !J(st, i).eliminado);
    proximoTodos(st, { acao, fila: ordem, protegidos: [] });
  }
  function proximoTodos(st, ctx) {
    while (ctx.fila.length) {
      const id = ctx.fila.shift(), q = J(st, id);
      const sujeito = ctx.acao === 'opmagma' ? !!q.treinador : ctx.acao === 'opaqua' ? q.itens.length > 1 : (ctx.acao !== 'rocket' || q.itens.length);
      if (temBoneca(q) && sujeito) {
        st.pend = { tipo: 'boneca', modo: 'todos', ctx, acao: TODOS_NOME[ctx.acao], acaoId: ctx.acao, alvo: id, respondente: id, bloqueado: false, titulo: `${q.nome}: usar Poké-Boneca contra ${TODOS_NOME[ctx.acao]}?` };
        return;
      }
    }
    aplicarTodos(st, ctx.acao, ctx.protegidos);
  }
  function aplicarTodos(st, acao, prot) {
    const afetados = st.jogadores.filter(q => !prot.includes(q.id) && !q.eliminado);
    if (acao === 'aqua') { afetados.forEach(q => { const n = q.itens.length; q.itens.slice().forEach(i => descartarItem(st, q, i)); comprarItem(st, q, n, true); }); log(st, `Invasão Aqua: ${afetados.map(q => q.nome).join(', ')} ${afetados.length > 1 ? 'trocaram' : 'trocou'} todos os Itens.`); }
    if (acao === 'magma') { afetados.forEach(q => { if (q.treinador) st.descartes.treinador.push(q.treinador); reporBaralho(st, 'treinador'); q.treinador = st.decks.treinador.shift() || null; }); log(st, `Invasão Magma: ${afetados.map(q => q.nome).join(', ')} ${afetados.length > 1 ? 'trocaram' : 'trocou'} de Treinador.`); }
    if (acao === 'rocket') {
      const N = st.jogadores.length, roubos = [];
      st.jogadores.forEach(q => { let d = 1; while (d < N && J(st, (q.id - d + N) % N).eliminado) d++; const v = J(st, (q.id - d + N) % N); if (prot.includes(v.id) || q.eliminado || v.eliminado || !v.itens.length || v.id === q.id) return; roubos.push([q, v, v.itens[Math.floor(rnd(st) * v.itens.length)]]); });
      roubos.forEach(([q, v, inst]) => { const i = v.itens.indexOf(inst); if (i >= 0) { v.itens.splice(i, 1); q.itens.push(inst); } });
      log(st, 'Invasão Rocket: ' + (roubos.map(([q, v]) => `${q.nome} pegou um Item de ${v.nome}`).join('; ') || 'ninguém tinha Itens para pegar') + '.');
    }
    if (acao === 'opaqua') {
      const ops = afetados.filter(q => q.id !== atv(st) && q.itens.length); st.opAqua = [];
      st.fila = ops.map(q => ['comoJogador', q.id, [['descAqua']]]).concat([['aquaCompra']], st.fila || []);
      if (!ops.length) log(st, 'Operação Aqua: nenhum oponente descartou Itens.');
    }
    if (acao === 'opmagma') {
      const ops = afetados.filter(q => q.id !== atv(st) && q.treinador), pool = [];
      ops.forEach(q => { pool.push(q.treinador); st.descartes.treinador.push(q.treinador); log(st, `Operação Magma: ${q.nome} descartou ${idx().tr[q.treinador].nome}.`, '', [['tr', q.treinador]]); q.treinador = null; });
      if (pool.length) st.pend = { tipo: 'magmaTroca', opcoes: pool, titulo: 'Operação Magma: trocar o seu Treinador por um dos descartados?' };
      else { log(st, 'Operação Magma: nenhum oponente tinha Treinador.'); reporTreinadores(st); }
    }
    if (prot.length) log(st, `Protegidos pela Poké-Boneca: ${prot.map(i => J(st, i).nome).join(', ')}.`);
  }
  // ranking com desempate escolhido por quem ativou o Evento
  function metrica(st, q, m) {
    if (m === 'capturas') return q.capturas;
    if (m === 'itens') return q.itens.length;
    if (m === 'forcaMax') return Math.max(0, ...q.pokemon.filter(id => obedece(q, P(id).cor)).map(id => forcaBase(q, id)));
    return 0;
  }
  function iniciarRanking(st, o) {
    const cands = st.jogadores.filter(q => !q.eliminado && !(o.excluirAtivo && q.id === atv(st))).map(q => ({ id: q.id, v: metrica(st, q, o.metrica) }));
    passoRanking(st, { o, restantes: cands, ganhadores: [] });
  }
  function passoRanking(st, R) {
    const n = Math.min(R.o.premios.length, R.ganhadores.length + R.restantes.length);
    while (R.ganhadores.length < n) {
      const best = R.o.ordem === 'min' ? Math.min(...R.restantes.map(c => c.v)) : Math.max(...R.restantes.map(c => c.v));
      const emp = R.restantes.filter(c => c.v === best);
      const vagas = n - R.ganhadores.length;
      if (emp.length > 1 && emp.length > vagas || (emp.length > 1 && R.o.premios.slice(R.ganhadores.length, R.ganhadores.length + emp.length).some((p, k, a) => JSON.stringify(p) !== JSON.stringify(a[0])))) {
        st.pend = { tipo: 'desempate', R, opcoes: emp.map(c => c.id), titulo: `Empate em ${{ capturas: 'capturas', itens: 'número de Itens', forcaMax: 'força do Pokémon mais forte' }[R.o.metrica]}: ${J(st).nome} escolhe quem recebe "${R.o.nomes[R.ganhadores.length]}"` };
        return;
      }
      const c = emp[0]; R.ganhadores.push(c.id); R.restantes = R.restantes.filter(x => x.id !== c.id);
    }
    finalizarRanking(st, R);
  }
  function escolherDesempate(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'desempate' || !pd.opcoes.includes(id)) return;
    const R = pd.R; R.ganhadores.push(id); R.restantes = R.restantes.filter(x => x.id !== id); st.pend = null; passoRanking(st, R); continuar(st);
  }
  function finalizarRanking(st, R) {
    const extra = [];
    R.ganhadores.forEach((id, k) => extra.push(['paraJogador', id, R.o.premios[k], R.o.nomes[k]]));
    st.fila = extra.concat(st.fila || []);
  }
  function paraJogador(st, id, passos, nome) {
    const q = J(st, id); log(st, `${q.nome} recebe: ${nome}.`, 'destaque');
    passos.forEach(([op, a, b]) => {
      if (op === 'itens') comprarItem(st, q, a);
      else if (op === 'itensEv') ganharItens(st, q, a);
      else if (op === 'ganhar') ganharCor(st, q, a === 'espaco' ? corEspaco(st) : a, b || 1);
      else if (op === 'darPokemon') ganharPokemon(st, q, a, 'presente');
    });
  }
  // Ruínas de Alph: compre 3, descarte 1
  function ruinas(st) { const p = J(st); const its = comprarItem(st, p, 3); if (its.length) st.pend = { tipo: 'descartarDe', itens: its, titulo: 'Ruínas de Alph: escolha um dos Itens comprados para descartar' }; }
  function descartarDe(st, inst) { const pd = st.pend; if (!pd || pd.tipo !== 'descartarDe' || !pd.itens.includes(inst)) return; const p = J(st); if (pd.aqua) descartarAqua(st, p, inst); else { descartarItem(st, p, inst); log(st, `${p.nome} descartou ${ITEM(inst).nome}.`); } st.pend = null; continuar(st); }
  function descartarAqua(st, p, inst) { descartarItem(st, p, inst); (st.opAqua || (st.opAqua = [])).push(inst); log(st, `Operação Aqua: ${p.nome} descartou ${ITEM(inst).nome}.`, '', [['it', inst.split('#')[0]]]); }
  // escolha: instância do item descartado, 'pilha' ou 'parar'
  function comprarAqua(st, escolha) {
    const pd = st.pend; if (!pd || pd.tipo !== 'aquaCompra') return; const p = J(st);
    if (escolha === 'parar') pd.resta = 0;
    else if (escolha === 'pilha') { comprarItem(st, p, 1); pd.resta--; log(st, `Operação Aqua: ${p.nome} comprou um Item da pilha.`); }
    else { if (!pd.pool.includes(escolha)) return; const i = st.descartes.item.indexOf(escolha); if (i >= 0) st.descartes.item.splice(i, 1); pd.pool.splice(pd.pool.indexOf(escolha), 1); p.itens.push(escolha); pd.resta--; log(st, `Operação Aqua: ${p.nome} pegou ${ITEM(escolha).nome} dos descartados.`, '', [['it', escolha.split('#')[0]]]); }
    if (pd.resta > 0) return; st.pend = null; continuar(st);
  }
  function resolverMagma(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'magmaTroca') return; const p = J(st);
    if (id && pd.opcoes.includes(id)) {
      const i = st.descartes.treinador.indexOf(id); if (i >= 0) st.descartes.treinador.splice(i, 1);
      if (p.treinador) st.descartes.treinador.push(p.treinador);
      log(st, `Operação Magma: ${p.nome} trocou ${p.treinador ? idx().tr[p.treinador].nome : 'nada'} por ${idx().tr[id].nome}.`, '', [['tr', id]]); p.treinador = id;
    } else log(st, `Operação Magma: ${p.nome} manteve o seu Treinador.`);
    st.pend = null; reporTreinadores(st); continuar(st);
  }
  // Jogadores não podem ficar sem Treinador: quem estiver sem compra um imediatamente
  function reporTreinadores(st) {
    st.jogadores.forEach(q => { if (q.treinador || q.eliminado) return; reporBaralho(st, 'treinador'); const t = st.decks.treinador.shift(); if (!t) return; q.treinador = t; log(st, `${q.nome} estava sem Treinador e comprou ${idx().tr[t].nome}.`, '', [['tr', t]]); });
  }
  // ---------- Criadores Pokémon ----------
  const CRIA_CORES = { 1: ['rosa', 'verde', 'azul'], 2: ['inicial', 'rosa', 'verde', 'azul', 'vermelho', 'amarelo'] };
  function linhasCriadores(p, n) { const f = {}; p.pokemon.forEach(id => { const k = P(id).familia || id; (f[k] = f[k] || []).push(id); }); return Object.values(f).filter(a => a.length >= n); }
  function opcoesCriadores(st, p) { p = p || J(st); return { 1: linhasCriadores(p, 2).length > 0, 2: linhasCriadores(p, 3).length > 0, 3: true }; }
  function foraDeJogoCriadores(st, op) { return CRIA_CORES[op].flatMap(c => (st.decks[c] || []).map(id => id)); }
  function resolverCriadores(st, op, descartar, pegar) {
    const pd = st.pend; if (!pd || pd.tipo !== 'criadores') return false; const p = J(st); op = +op;
    if (op === 3) { st.pend = null; log(st, `Criadores Pokémon: ${p.nome} vai comprar 2 Itens.`); ganharItens(st, p, 2); continuar(st); return true; }
    const n = op === 1 ? 2 : op === 2 ? 3 : 0; if (!n || !Array.isArray(descartar) || descartar.length !== n) return false;
    if (new Set(descartar).size !== n || !descartar.every(id => p.pokemon.includes(id))) return false;
    const fam = P(descartar[0]).familia; if (!fam || !descartar.every(id => P(id).familia === fam)) return false;
    const cor = CRIA_CORES[op].find(c => (st.decks[c] || []).includes(pegar)); if (!cor) return false;
    st.pend = null;
    descartar.forEach(id => { p.pokemon.splice(p.pokemon.indexOf(id), 1); delete p.mais1[id]; if (st.decks[P(id).cor]) devolver(st, P(id).cor, id); });
    log(st, `Criadores Pokémon: ${p.nome} descartou ${descartar.map(id => P(id).nome).join(', ')}.`, '', descartar.map(id => ['pk', id]));
    if (st.trocasCarta) st.trocasCarta.push({ j: p.id, devolvidos: descartar.slice() });
    st.decks[cor].splice(st.decks[cor].indexOf(pegar), 1); ganharPokemon(st, p, pegar, 'Criadores Pokémon');
    continuar(st); return true;
  }
  function kurt(st) { const p = J(st); const its = comprarItem(st, p, 2); if (its.some(i => ITEM(i).bola)) { log(st, 'Kurt: saiu uma Poké-Bola, compra mais um Item.'); comprarItem(st, p, 1); } }

  // ---------- Grupo 3: escolher cartas no tabuleiro / fora dele ----------
  const ESCALA = ['rosa', 'verde', 'azul', 'vermelho'];
  function noPlanalto(st) { const s = grafo(st).nodes[J(st).pos]; return D().hexes[s.hex].tier === 'fim'; }
  function corLimite(st) { return noPlanalto(st) ? 'vermelho' : (corEspaco(st) === 'amarelo' ? 'vermelho' : corEspaco(st)); }
  function marcas(st) { st.turno = st.turno || {}; return (st.turno.marcas = st.turno.marcas || {}); }
  function filtrarSlots(st, f) {
    const g = grafo(st), eu = J(st), hexEu = g.nodes[eu.pos].pos, M = marcas(st);
    return Object.values(g.slots).filter(s => {
      const c = st.slots[s.key]; if (!c || !c.carta) return false;
      const cor = P(c.carta).cor;
      if (f.hex && s.pos !== hexEu) return false;
      if (f.cores && !f.cores.includes(cor)) return false;
      if (f.aberta === true && !c.aberta) return false;
      if (f.aberta === false && c.aberta) return false;
      if (f.marca && !(M[f.marca] || []).includes(s.key)) return false;
      if (f.coresDistintas && (M[f.coresDistintas + ':cores'] || []).includes(cor)) return false;
      if (f.excluirMarca && (M[f.excluirMarca] || []).includes(s.key)) return false;
      if (f.hexDistintos && (M[f.hexDistintos + ':hex'] || []).includes(s.pos)) return false;
      if (f.familias && !f.familias.includes(P(c.carta).familia)) return false;
      return true;
    }).map(s => s.key);
  }
  function slotSel(st, f) {
    const ops = filtrarSlots(st, f);
    if (!ops.length) { log(st, f.vazio || 'Nenhum Pokémon disponível para este efeito.'); return; }
    st.pend = { tipo: 'slot', opcoes: ops, f, titulo: f.titulo || 'Escolha um Pokémon no tabuleiro' };
  }
  function escolherSlot(st, k) {
    const pd = st.pend; if (!pd || pd.tipo !== 'slot' || !pd.opcoes.includes(k)) return;
    const f = pd.f, M = marcas(st), c = st.slots[k];
    if (f.marcar) (M[f.marcar] = M[f.marcar] || []).push(k);
    if (f.coresDistintas) (M[f.coresDistintas + ':cores'] = M[f.coresDistintas + ':cores'] || []).push(P(c.carta).cor);
    if (f.hexDistintos) (M[f.hexDistintos + ':hex'] = M[f.hexDistintos + ':hex'] || []).push(grafo(st).slots[k].pos);
    st.pend = null;
    if (f.acao === 'revelar') { if (revelar(st, k)) janelaRepel(st, [k]); }
    else if (f.acao === 'pegar') { const id = c.carta; st.slots[k] = { carta: tirar(st, grafo(st).slots[k].cor), aberta: false, fraco: false }; ganharPokemon(st, J(st), id, 'de graça'); }
    else if (f.acao === 'capturar') { const nova = revelar(st, k); iniciarCaptura(st, { slot: k }); if (nova) janelaRepel(st, [k]); }
    continuar(st);
  }
  function rotaBloqueada(st) {
    const f = { hex: true, cores: ['rosa', 'verde', 'azul'], acao: 'pegar', titulo: 'Rota Bloqueada: pegue de graça um Pokémon Azul ou mais fraco do seu hexágono' };
    if (filtrarSlots(st, f).length) slotSel(st, f);
    else slotSel(st, { hex: true, acao: 'capturar', titulo: 'Rota Bloqueada: tente capturar um Pokémon do seu hexágono' });
  }
  function tempestade(st) {
    const g = grafo(st), hexEu = g.nodes[J(st).pos].pos; let n = 0; const ks = [];
    Object.values(g.slots).filter(s => s.pos === hexEu).forEach(s => { const c = st.slots[s.key]; if (c && c.carta) devolver(st, s.cor, c.carta); st.slots[s.key] = { carta: tirar(st, s.cor), aberta: true, fraco: false }; n++; ks.push(s.key); });
    log(st, `Tempestade Pesada: ${n} Pokémon(s) do hexágono foram substituídos e revelados.`, 'destaque');
    janelaRepel(st, ks);
  }
  // Kimono Girl / Pesquisa de Oak: escolher tipo e cor
  function pedirTipoCor(st, o) {
    const lim = o.limite ? ESCALA.indexOf(corLimite(st)) : 3;
    st.pend = { tipo: 'tipoCor', cores: ESCALA.slice(0, lim + 1), titulo: o.titulo || 'Escolha um tipo e uma cor' };
  }
  function resolverTipoCor(st, tipo, cor) {
    const pd = st.pend; if (!pd || pd.tipo !== 'tipoCor' || !pd.cores.includes(cor)) return;
    const dk = st.decks[cor], i = dk.findIndex(id => P(id).tipos.includes(tipo));
    st.pend = null;
    if (i < 0) log(st, `Não há Pokémon ${cor} do tipo ${TIPOS_NOME[tipo]} fora do jogo.`);
    else { const id = dk.splice(i, 1)[0]; ganharPokemon(st, J(st), id, `${TIPOS_NOME[tipo]} ${cor}`); }
    continuar(st);
  }
  // Expert em Fósseis / Encontro Lendário
  function revelarEscolher(st, cor, n, pegar) {
    const cartas = []; for (let i = 0; i < n; i++) { const c = tirar(st, cor); if (c) cartas.push(c); }
    if (!cartas.length) return;
    if (pegar) st.pend = { tipo: 'pegarDeLista', cartas, cor, faltam: Math.min(pegar, cartas.length), titulo: `Escolha ${Math.min(pegar, cartas.length)} para pegar de graça` };
    else st.pend = { tipo: 'escolherCaptura', cartas, cor, titulo: `Revelados os ${cartas.length} próximos Pokémons ${cor}s: escolha um para tentar capturar` };
  }
  function pegarDeLista(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'pegarDeLista' || !pd.cartas.includes(id)) return;
    pd.cartas.splice(pd.cartas.indexOf(id), 1); ganharPokemon(st, J(st), id, 'de graça'); pd.faltam--;
    if (pd.faltam > 0 && pd.cartas.length) { pd.titulo = `Escolha mais ${pd.faltam}`; return; }
    pd.cartas.forEach(c => devolver(st, pd.cor, c)); st.pend = null; continuar(st);
  }
  // Diglett: ir a outro espaço do hexágono e ativá-lo
  function pedirEspaco(st, o) {
    const g = grafo(st), eu = J(st), hexEu = g.nodes[eu.pos].pos;
    const ops = Object.values(g.nodes).filter(n => n.pos === hexEu && n.key !== eu.pos && !['porta', 'passagem'].includes(n.kind) && !(n.especial === 'planalto' && nInsignias(eu) < 6)).map(n => n.key);
    if (o.ficar) ops.push(eu.pos);
    if (!ops.length) return;
    st.pend = { tipo: 'espaco', opcoes: ops, ativar: o.ativar !== false, titulo: o.titulo || 'Escolha um espaço neste hexágono' };
  }
  function adjacentes(st, k) {
    const g = grafo(st), p = J(st), out = new Set(), vis = new Set([k]);
    (function ir(x) { for (const { to } of g.adj[x] || []) { if (vis.has(to)) continue; vis.add(to); const n = g.nodes[to];
      if (n.kind === 'porta') { ir(to); continue; }
      if (n.kind === 'passagem') { if (!n.tipo || p.pokemon.some(id => P(id).tipos.includes(n.tipo))) ir(to); continue; }
      if (n.especial === 'planalto' && nInsignias(p) < 6) continue;
      out.add(to); } })(k);
    return [...out];
  }
  function escolherEspaco(st, k) {
    const pd = st.pend; if (!pd || pd.tipo !== 'espaco' || !pd.opcoes.includes(k)) return; const p = J(st);
    if (pd.sóAtivar) { st.pend = null; log(st, `${p.nome} ativou ${nomeEspaco(st, k)}.`); chegar(st, k, { remoto: k !== p.pos }); continuar(st); return; }
    st.pend = null; if (k === p.pos) { log(st, `${p.nome} ficou onde estava.`); continuar(st); return; } p.pos = k; addU(p.passou, k); log(st, `${p.nome} foi para ${nomeEspaco(st, k)}.`);
    if (pd.ativar) chegar(st, k); continuar(st);
  }
  function novoInicio(st) {
    const g = grafo(st), eu = J(st), hexEu = g.nodes[eu.pos].pos;
    const c = Object.values(g.nodes).find(n => n.pos === hexEu && n.kind === 'cidade');
    if (c) { eu.pos = c.key; addU(eu.passou, c.key); log(st, `${eu.nome} voltou para ${nomeEspaco(st, c.key)}.`); }
  }
  function gsBall(st) { const p = J(st), c = tirar(st, 'rosa'); if (!c) return; ganharPokemon(st, p, c, 'Bola GS'); p.mais1[c] = (p.mais1[c] || 0) + 1; log(st, `${P(c).nome} recebe um marcador +1 permanente (não protegido contra trocas).`); }
  // Ginásio Alternativo
  function pedirLiderFora(st) {
    const p = J(st), ops = st.lideresFora.filter(id => podeEnfrentar(p, idx().ld[id]));
    if (!ops.length) { log(st, 'Não há Líder fora de jogo que você possa enfrentar.'); return; }
    st.pend = { tipo: 'escolherLider', opcoes: ops, titulo: 'Ginásio Alternativo: escolha o Líder a enfrentar' };
  }
  function escolherLiderFora(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'escolherLider' || !pd.opcoes.includes(id)) return;
    st.pend = { tipo: 'lider', cidade: null, lider: id, alternativo: true, titulo: 'Ginásio Alternativo: ' + idx().ld[id].nome, resultado: null };
  }
  // Pagar itens (Proposta de N)
  function pedirPagamento(st, n, depois, titulo) { const p = J(st); if (p.itens.length < n) { log(st, 'Itens insuficientes.'); return; } st.pend = { tipo: 'pagarItens', n, depois, titulo }; }
  function pagarItens(st, insts) {
    const pd = st.pend; if (!pd || pd.tipo !== 'pagarItens' || insts.length !== pd.n) return; const p = J(st);
    insts.forEach(i => descartarItem(st, p, i)); st.pend = null; st.fila = pd.depois.concat(st.fila || []); continuar(st);
  }
  function propostaN(st) {
    const p = J(st), c1 = corLimite(st), c2 = ESCALA[Math.min(3, ESCALA.indexOf(c1) + 1)], ops = [];
    if (p.itens.length >= 1) ops.push({ nome: `Descartar 1 Item → Pokémon ${c1}`, passos: [['pagar', 1, [['ganhar', c1, 1]], 'Proposta de N: descarte 1 Item']] });
    if (p.itens.length >= 2) ops.push({ nome: `Descartar 2 Itens → Pokémon ${c2}`, passos: [['pagar', 2, [['ganhar', c2, 1]], 'Proposta de N: descarte 2 Itens']] });
    ops.push({ nome: 'Não fazer nada', passos: [] });
    st.pend = { tipo: 'opcao', opcoes: ops, titulo: 'Proposta de N' };
  }
  // Negociador: opcional, devolver 2 da mesma cor e ganhar 1 dessa cor
  function negociador(st) { const p = J(st); const cores = {}; p.pokemon.forEach(id => { const c = P(id).cor; if (c !== 'inicial' && c !== 'amarelo') cores[c] = (cores[c] || 0) + 1; }); if (Object.values(cores).some(n => n >= 2)) st.pend = { tipo: 'negociador', titulo: 'Negociador (opcional): devolva 2 Pokémons da mesma cor e ganhe 1 dessa cor' }; }
  function resolverNegociador(st, ids) {
    const pd = st.pend; if (!pd || pd.tipo !== 'negociador') return; const p = J(st);
    if (ids && ids.length === 2 && P(ids[0]).cor === P(ids[1]).cor && ids.every(i => p.pokemon.includes(i))) {
      const cor = P(ids[0]).cor; ids.forEach(i => { p.pokemon.splice(p.pokemon.indexOf(i), 1); delete p.mais1[i]; devolver(st, cor, i); });
      log(st, `${p.nome} devolveu ${ids.map(i => P(i).nome).join(' e ')}.`); if (st.trocasCarta) st.trocasCarta.push({ j: p.id, devolvidos: ids.slice() }); ganharCor(st, p, cor, 1);
    }
    st.pend = null; continuar(st);
  }
  // Previsão de Sabrina: revele 5 Itens, compre 3, depois descarte 1 da mão
  function sabrina(st) {
    const its = []; for (let i = 0; i < 5; i++) { reporBaralho(st, 'item'); const c = st.decks.item.shift(); if (c) its.push(c); }
    if (its.length) st.pend = { tipo: 'pegarItens', itens: its, faltam: Math.min(3, its.length), titulo: 'Previsão de Sabrina: escolha 3 Itens' };
  }
  function pegarItem(st, inst) {
    const pd = st.pend; if (!pd || pd.tipo !== 'pegarItens' || !pd.itens.includes(inst)) return; const p = J(st);
    pd.itens.splice(pd.itens.indexOf(inst), 1); p.itens.push(inst); pd.faltam--;
    if (pd.faltam > 0) { pd.titulo = `Escolha mais ${pd.faltam}`; return; }
    st.decks.item.push(...pd.itens); st.pend = null;
    if (p.itens.length) st.pend = { tipo: 'descartarDe', itens: p.itens.slice(), titulo: 'Previsão de Sabrina: descarte um Item' };
    else continuar(st);
  }


  // ---------- Grupo 4: efeitos que duram ----------
  const EF_NOME = { encrenca: 'Encrenca em Dobro', parque: 'Parque Nacional', suborno: 'Suborno Rocket', briney: 'Barco de Briney' };
  function criarEfeito(st, tipo, dur) {
    st.efeitos = st.efeitos || []; const p = J(st);
    const e = { tipo, dono: p.id, rest: dur, nome: EF_NOME[tipo] };
    if (tipo === 'parque') e.ganhos = {};
    st.efeitos.push(e); log(st, `${EF_NOME[tipo]} está ativo (${dur} rodada${dur > 1 ? 's' : ''}).`, 'destaque');
  }
  function encrencado(st, p) { return (st.efeitos || []).some(e => e.tipo === 'encrenca' && e.dono !== p.id); }
  function tickEfeitos(st) {
    const vez = st.vez, fim = [];
    st.efeitos.forEach(e => { if (e.dono === vez) { e.rest--; if (e.rest <= 0) fim.push(e); } });
    st.efeitos = st.efeitos.filter(e => !fim.includes(e));
    fim.forEach(e => {
      log(st, `${e.nome} terminou.`);
      if (e.tipo === 'suborno' && e.copiou) { J(st, e.dono).pular += 1; log(st, `${J(st, e.dono).nome} copiou efeitos com o Suborno Rocket e perde este turno.`); }
      if (e.tipo === 'parque') premiarParque(st, e);
    });
  }
  function premiarParque(st, e) {
    const forca = id => P(id).forca;
    const todos = st.jogadores.map(q => ({ q, ids: (e.ganhos[q.id] || []).slice(), n: (e.ganhos[q.id] || []).length, f: (e.ganhos[q.id] || []).reduce((a, id) => a + forca(id), 0) }))
      .sort((a, b) => b.n - a.n || b.f - a.f);
    const lista = todos.filter(x => x.n > 0);
    const premios = [
      q => { const antes = q.pokemon.length; ganharCor(st, q, 'vermelho', 1); const id = q.pokemon.length > antes ? q.pokemon[q.pokemon.length - 1] : null; return { texto: id ? 'Pokémon Vermelho: ' + P(id).nome : 'Pokémon Vermelho (baralho vazio)', pk: id }; },
      q => { const its = comprarItem(st, q, 3); return { texto: '3 Cartas Item', itens: its }; },
      q => { const its = comprarItem(st, q, 1); return { texto: '1 Carta Item', itens: its }; }];
    const linhas = todos.map(x => ({ jogador: x.q.id, n: x.n, f: x.f, ids: x.ids, lugar: null, premio: null }));
    if (!lista.length) log(st, 'Parque Nacional: ninguém capturou Pokémon.');
    lista.slice(0, 3).forEach((x, k) => {
      log(st, `Parque Nacional — ${k + 1}º lugar: ${x.q.nome} (${x.n} captura${x.n > 1 ? 's' : ''}).`, 'destaque');
      const pr = premios[k](x.q), L = linhas.find(l => l.jogador === x.q.id); L.lugar = k + 1; L.premio = pr;
    });
    st.rolSeq = (st.rolSeq || 0) + 1;
    st.resultadoParque = { seq: st.rolSeq, dono: e.dono, linhas };
  }



  // ---------- Cidades: Azalea, Driftveil/Mistralton, Fuchsia ----------
  function resolverAzalea(st, meu) {
    const pd = st.pend; if (!pd || pd.tipo !== 'azalea' || !pd.cartas.includes(meu)) return;
    const outro = pd.cartas.find(c => c !== meu);
    st.pend = { tipo: 'carta', baralho: 'evento', carta: meu, ativado: false, titulo: idx().ev[meu].nome };
    if (outro) { if (st.jogadores.length > 1) st.fila.unshift(['alvo', 'eventoCarta', { bloqueavel: false, carta: outro }]); else st.descartes.evento.push(outro); }
  }
  function distribuirEvento(st, jogador, carta) {
    const pd = st.pend; if (!pd || pd.tipo !== 'distribuir' || !pd.cartas.includes(carta) || pd.atribuido[jogador] != null) return;
    pd.atribuido[jogador] = carta; pd.cartas.splice(pd.cartas.indexOf(carta), 1);
    if (pd.cartas.length && Object.keys(pd.atribuido).length < pd.jogadores.length) return;
    st.pend = null;
    const ordem = pd.jogadores.slice().sort((a, b) => (a === atv(st) ? -1 : b === atv(st) ? 1 : 0));
    const bar = pd.baralho || 'evento', ix = bar === 'evento' ? idx().ev : idx().sev;
    st.fila = ordem.filter(j => pd.atribuido[j] != null).map(j => ['comoJogador', j, [['cartaPronta', pd.atribuido[j], bar]]]).concat(st.fila || []);
    log(st, (bar === 'evento' ? 'Eventos' : 'Super Eventos') + ' distribuídos: ' + ordem.filter(j => pd.atribuido[j] != null).map(j => `${J(st, j).nome} → ${ix[pd.atribuido[j]].nome}`).join('; ') + '.', '', ordem.filter(j => pd.atribuido[j] != null).map(j => [bar === 'evento' ? 'ev' : 'sev', pd.atribuido[j]]));
    continuar(st);
  }
  function resolverFuchsia(st, manter) {
    const pd = st.pend; if (!pd || pd.tipo !== 'fuchsia' || !pd.cartas.includes(manter)) return;
    const outro = pd.cartas.find(c => c !== manter); st.pend = null;
    ganharPokemon(st, J(st), manter, 'Fuchsia');
    if (outro) st.fila.unshift(['ranking', { metrica: 'capturas', ordem: 'min', premios: [[['darPokemon', outro]]], nomes: [P(outro).nome], excluirAtivo: true }]);
    continuar(st);
  }


  function resolverJuniper(st, inst) {
    const pd = st.pend; if (!pd || pd.tipo !== 'juniper') return;
    const d = J(st, pd.doador), r = J(st, pd.receptor), i = d.itens.indexOf(inst); if (i < 0) return;
    d.itens.splice(i, 1); r.itens.push(inst); log(st, `${d.nome} deu ${ITEM(inst).nome} para ${r.nome}.`, '', [['it', inst.split('#')[0]]]);
    if (pd.etapa === 1) { st.pend = { tipo: 'juniper', etapa: 2, doador: r.id, receptor: d.id, alvo: pd.alvo, titulo: `Prof. Juniper: ${r.nome}, escolha um Item para dar a ${d.nome}` }; return; }
    st.pend = null; st.fila.unshift(['juniperFim', pd.alvo]); continuar(st);
  }


  // Festival Pokémon: cada jogador pode trocar 1 Pokémon (quem ativou, 2) por outro aleatório da mesma cor
  function ajustarFestival(st) {
    const pd = st.pend;
    while (pd.i < pd.ordem.length) { const q = J(st, pd.ordem[pd.i]); if (q.pokemon.some(id => st.decks[P(id).cor] && st.decks[P(id).cor].length && !pd.trocados.includes(id))) break; pd.i++; pd.restam = 1; }
    if (pd.i >= pd.ordem.length) { st.pend = null; return; }
    const q = J(st, pd.ordem[pd.i]); pd.jogador = q.id;
    pd.titulo = `Festival Pokémon: ${q.nome}, troque ${pd.restam > 1 ? 'até 2 Pokémons' : 'um Pokémon'} por outro aleatório da mesma cor (opcional)`;
  }
  function resolverFestival(st, id) {
    const pd = st.pend; if (!pd || pd.tipo !== 'festival') return; const q = J(st, pd.jogador);
    if (id) {
      if (!q.pokemon.includes(id) || pd.trocados.includes(id)) return;
      const cor = P(id).cor, novo = tirar(st, cor); if (!novo) return;
      q.pokemon[q.pokemon.indexOf(id)] = novo; delete q.mais1[id]; devolver(st, cor, id); pd.trocados.push(novo);
      if (st.trocasCarta) st.trocasCarta.push({ j: q.id, saiu: id, entrou: novo });
      log(st, `Festival Pokémon: ${q.nome} trocou ${P(id).nome} por ${P(novo).nome}.`, '', [['pk', id], ['pk', novo]]);
      pd.restam--;
    } else pd.restam = 0;
    if (pd.restam <= 0) { pd.i++; pd.restam = 1; }
    ajustarFestival(st); if (!st.pend) continuar(st);
  }


  // Módulo de Lura: trocar dois Pokémons de lugar (mesma cor, pelo menos um revelado)
  function luraParceiros(st, k) {
    const a = st.slots[k]; if (!a || !a.carta) return [];
    return Object.keys(st.slots).filter(x => x !== k && st.slots[x].carta && P(st.slots[x].carta).cor === P(a.carta).cor && (a.aberta || st.slots[x].aberta));
  }
  function luraOpcoes(st) { return Object.keys(st.slots).filter(k => luraParceiros(st, k).length); }
  function escolherLura(st, k) {
    const pd = st.pend; if (!pd || pd.tipo !== 'lura') return;
    if (pd.primeiro && k === pd.primeiro) { pd.primeiro = null; pd.opcoes = luraOpcoes(st); pd.titulo = 'Módulo de Lura: escolha o primeiro Pokémon'; return; }
    if (!pd.opcoes.includes(k)) return;
    if (!pd.primeiro) { pd.primeiro = k; pd.opcoes = luraParceiros(st, k); pd.titulo = 'Módulo de Lura: escolha com qual trocar de lugar'; return; }
    const a = pd.primeiro; [st.slots[a], st.slots[k]] = [st.slots[k], st.slots[a]];
    const nome = x => st.slots[x].aberta ? P(st.slots[x].carta).nome : 'um Pokémon virado';
    log(st, `Módulo de Lura: ${nome(k)} e ${nome(a)} trocaram de lugar.`);
    st.pend = null; continuar(st);
  }


  // ---------- Propostas de troca entre jogadores humanos ----------
  // no seu turno, o jogador propõe trocar até 3 Pokémon seus por até 3 do alvo; o alvo responde no início do turno dele
  const MAX_PROPOSTA = 3;
  function trocavel(p, id) { return p.pokemon.includes(id) && !familiaTravada(p, id); }
  function propostaValida(st, pr) {
    const a = J(st, pr.de), b = J(st, pr.para);
    return !!a && !!b && !a.eliminado && !b.eliminado && !b.ia && pr.meus.every(id => trocavel(a, id)) && pr.deles.every(id => trocavel(b, id));
  }
  function alvosProposta(st) { const p = J(st); return st.jogadores.filter(q => q.id !== p.id && !q.ia && !q.eliminado).map(q => q.id); }
  function podeProporTroca(st) { const p = J(st); return st.vencedor == null && !st.pend && st.ator == null && !p.ia && !p.eliminado && alvosProposta(st).length > 0; }
  function proporTroca(st, para, meus, deles) {
    const p = J(st), q = J(st, para); if (!podeProporTroca(st) || !q || !alvosProposta(st).includes(para)) return;
    meus = [...new Set(meus || [])]; deles = [...new Set(deles || [])];
    if (meus.length > MAX_PROPOSTA || deles.length > MAX_PROPOSTA || !(meus.length + deles.length)) return;
    const pr = { id: (st.propSeq = (st.propSeq || 0) + 1), de: p.id, para, meus, deles, rodada: st.rodada };
    if (!propostaValida(st, pr)) return;
    const antes = (st.propostas || []).some(x => x.de === p.id && x.para === para);
    st.propostas = (st.propostas || []).filter(x => !(x.de === p.id && x.para === para)); st.propostas.push(pr);
    log(st, `${p.nome} ${antes ? 'refez sua' : 'enviou uma'} proposta de troca para ${q.nome}.`);
  }
  // o próprio autor pode retirar a proposta enquanto ela não estiver sendo avaliada
  function cancelarProposta(st, quem, id) {
    const pr = (st.propostas || []).find(x => x.id === id); if (!pr || pr.de !== quem || (st.pend && st.pend.tipo === 'proposta' && st.pend.id === id)) return;
    st.propostas = st.propostas.filter(x => x !== pr); log(st, `${J(st, quem).nome} retirou a proposta de troca para ${J(st, pr.para).nome}.`);
  }
  // no início do turno do alvo: descarta as que perderam a validade e abre a próxima
  function abrirProposta(st) {
    if (st.pend || !st.propostas || !st.propostas.length) return; const p = J(st);
    st.propostas = st.propostas.filter(pr => {
      if (pr.para !== p.id || propostaValida(st, pr)) return true;
      log(st, `A proposta de troca de ${J(st, pr.de).nome} para ${p.nome} perdeu a validade (os Pokémon mudaram).`); return false;
    });
    const pr = st.propostas.find(x => x.para === p.id); if (!pr) return;
    st.pend = { tipo: 'proposta', id: pr.id, de: pr.de, para: pr.para, meus: pr.meus.slice(), deles: pr.deles.slice(), titulo: `Proposta de troca de ${J(st, pr.de).nome}` };
  }
  function responderProposta(st, aceita) {
    const pd = st.pend; if (!pd || pd.tipo !== 'proposta') return;
    const pr = (st.propostas || []).find(x => x.id === pd.id); st.propostas = (st.propostas || []).filter(x => x.id !== pd.id);
    const a = J(st, pd.de), b = J(st, pd.para), nomes = l => !l.length ? 'nada' : l.length === 1 ? P(l[0]).nome : l.slice(0, -1).map(id => P(id).nome).join(', ') + ' e ' + P(l[l.length - 1]).nome;
    let feita = false;
    if (aceita && pr && propostaValida(st, pr)) {
      pr.meus.forEach(id => { a.pokemon.splice(a.pokemon.indexOf(id), 1); b.pokemon.push(id); moverMais1(a, b, id); });
      pr.deles.forEach(id => { b.pokemon.splice(b.pokemon.indexOf(id), 1); a.pokemon.push(id); moverMais1(b, a, id); });
      feita = true;
      log(st, `${b.nome} aceitou a troca: ${a.nome} entregou ${nomes(pr.meus)} e recebeu ${nomes(pr.deles)}.`, 'destaque', [...pr.meus, ...pr.deles].map(id => ['pk', id]));
    } else if (aceita) log(st, `A proposta de troca de ${a.nome} perdeu a validade.`);
    else log(st, `${b.nome} recusou a proposta de troca de ${a.nome}.`);
    st.trocaAviso = { seq: (st.trocaAviso ? st.trocaAviso.seq : 0) + 1, de: a.id, para: b.id, aceita: feita };
    st.pend = null; abrirProposta(st); if (!st.pend) continuar(st);
  }

  // ---------- Despachante de ações (base do modo on-line) ----------
  // quem pode responder à decisão pendente agora
  function quemDecide(st) {
    const pd = st.pend; if (!pd) return st.vencedor != null ? [] : [atv(st)];
    switch (pd.tipo) {
      case 'treinador': case 'festival': return [pd.jogador];
      case 'travar': return [pd.jogador != null ? pd.jogador : atv(st)];
      case 'juniper': return [pd.doador];
      case 'briney': return [pd.dono];
      case 'boneca': case 'cynthia': return [pd.respondente];
      case 'duelo': case 'ligaBatalha': case 'praca': return [pd.a, pd.b];
      case 'ligaOponente': return [pd.escolhe];
      case 'repel': return pd.opcoes.filter(j => pd.resp[j] == null);
      case 'campeao': return st.jogadores.map(q => q.id);
      case 'proposta': return [pd.para];
      case 'carta': if (reacaoAberta(st)) return Object.keys(pd.reacao.opcoes).map(Number).filter(j => pd.reacao.resp[j] == null); return [atv(st)];
      default: return [atv(st)];
    }
  }
  const ACOES_TURNO = new Set(['rolarMovimento', 'escolherDado', 'hiker', 'ajustarRolagem', 'mover', 'trem', 'encerrarTurno', 'lyra', 'abrirLider', 'usarItem', 'celebiMovimento', 'descartarExcesso',
    'rolarCaptura', 'celebiCaptura', 'lutarLider', 'remedio', 'celebiLider', 'aceitarTabela', 'celebiTabela', 'celebiDuelo', 'celebiPraca', 'ativarCarta', 'concluirCarta', 'proporTroca']);
  const ACOES_LADO = new Set(['escolherDuelo', 'ligaEscolher', 'escolherDuplaPraca', 'ligaCelebi', 'ligaRemedio']);
  const ACOES_JOGADOR = new Set(['reagir', 'reagirRepel']); // o 1º argumento é o próprio jogador
  const ACOES_ANFITRIAO = new Set(['ferramenta', 'encerrarReacoes', 'encerrarRepel', 'iniciarLiga']);
  function podeAgir(st, j, nome, args) {
    if (j === 'host') return true;
    if (ACOES_ANFITRIAO.has(nome)) return false;
    const pd = st.pend;
    if (ACOES_JOGADOR.has(nome)) return args[0] === j && quemDecide(st).includes(j);
    if (nome === 'cancelarProposta') return args[0] === j;
    if (ACOES_LADO.has(nome)) return !!pd && ['a', 'b'].includes(args[0]) && pd[args[0]] === j;
    if (['ligaSeguir', 'fecharPraca', 'fecharDuelo'].includes(nome)) return !!pd && (pd.a === j || pd.b === j || atv(st) === j);
    if (ACOES_TURNO.has(nome)) return atv(st) === j;
    return quemDecide(st).includes(j);
  }
  // executa uma ação em nome de um jogador (j = id) ou do anfitrião (j = 'host', usado no modo local)
  function acao(st, j, nome, ...args) {
    const fn = API[nome]; if (typeof fn !== 'function' || !podeAgir(st, j, nome, args)) return false;
    fn(st, ...args); posAcao(st); return true;
  }
  // desistir de tentar a captura (antes de rolar): a carta comprada da pilha volta para ela
  function desistirCaptura(st) { const pd = st.pend; if (!pd || pd.tipo !== 'captura' || pd.resultado) return; if (!pd.slot) devolver(st, pd.cor, pd.carta); st.pend = null; continuar(st); }
  // ---------- Estado filtrado: o que cada jogador pode ver (j = id; -1 = espectador) ----------
  const PEND_PRIVADO = new Set(['treinador', 'pegarItens', 'dividir', 'descartarDe', 'juniper', 'escolherEvento', 'distribuir', 'azalea', 'wally', 'descartar', 'pagarItens']);
  function vistaDe(st, j) {
    const v = JSON.parse(JSON.stringify(st, (k, x) => (k === 'token' ? undefined : x)));
    v.rng = 0;
    ['item', 'evento', 'superevento', 'treinador'].forEach(k => { if (v.decks[k]) v.decks[k] = v.decks[k].map(() => '?'); });
    ['inicial', 'rosa', 'verde', 'azul', 'vermelho', 'amarelo'].forEach(c => { if (v.decks[c]) v.decks[c].sort(); }); // fora do jogo: conteúdo público, ordem escondida
    const fake = {}; D().pokemon.forEach(c => { if (!fake[c.cor]) fake[c.cor] = c.id; });
    Object.values(v.slots).forEach(x => { if (x && x.carta && !x.aberta) x.carta = fake[P(x.carta).cor] || x.carta; });
    v.jogadores.forEach(q => { if (q.id !== j) { q.itens = q.itens.map((_, k) => 'oculto#' + k); q.treinadoresExtra = q.treinadoresExtra.map(() => '?'); } });
    const pd = v.pend, lado = pd && (pd.a === j ? 'a' : pd.b === j ? 'b' : null);
    if (pd) {
      if (pd.tipo === 'duelo' && pd.escolhas) ['a', 'b'].forEach(l => { if (l !== lado && pd.escolhas[l]) pd.escolhas[l] = { oculto: true }; });
      if (pd.tipo === 'ligaBatalha') ['a', 'b'].forEach(l => { if (l !== lado && pd.esc[l]) pd.esc[l] = { oculto: true }; });
      if (pd.tipo === 'praca' && !pd.resultado) ['a', 'b'].forEach(l => { if (l !== lado && pd.dupla[l]) { pd.dupla[l] = []; pd.itens[l] = {}; } });
      if (pd.tipo === 'carta' && pd.reacao && pd.reacao !== 'ok') { const R = pd.reacao, o = {}, r = {}; if (R.opcoes[j]) o[j] = R.opcoes[j]; if (R.resp[j] != null) r[j] = R.resp[j]; R.opcoes = o; R.resp = r; }
      if (pd.tipo === 'repel') { pd.opcoes = pd.opcoes.filter(x => x === j); const r = {}; if (pd.resp[j] != null) r[j] = pd.resp[j]; pd.resp = r; }
      if (PEND_PRIVADO.has(pd.tipo) && !quemDecide(st).includes(j)) { if (pd.itens) pd.itens = []; if (pd.cartas) pd.cartas = []; if (pd.pool) pd.pool = []; pd.privado = true; }
      if (pd.depois && pd.depois.tipo === 'captura') { /* captura pública */ }
      if (pd.tipo === 'proposta' && pd.de !== j && pd.para !== j) { pd.meus = []; pd.deles = []; pd.privado = true; }
    }
    if (v.propostas) v.propostas = v.propostas.filter(pr => pr.de === j || pr.para === j);
    v.fila = []; v.vista = j;
    return v;
  }
  // ajustes automáticos depois de qualquer ação (no anfitrião)
  function posAcao(st) { const pd = st.pend; if (pd && pd.tipo === 'carta' && !pd.ativado && pd.reacao == null) iniciarReacoes(st); }
  const API = G.Engine = {
    novoJogo, grafo, destinos, rolarMovimento, escolherDado, hiker, ajustarRolagem, mover, trem, encerrarTurno, podeEncerrar, descartarExcesso,
    ativarCarta, concluirCarta, fecharPend, rolarCaptura, escolherCaptura, escolherEvento, escolherTreinador, travar, abrirLider, lutarLider, remedio,
    podeEnfrentar, usarItem, lyra, ferramenta, duelo, forcaBase, forcaEmBatalha, bonusEvolucao, bonusTreinador, obedece, nInsignias, limiteItens, faixaCaptura,
    nomeEspaco, familiaTravada, posXY, autoTexto, escolherAlvo, responderBoneca, iniciarReacoes, reacaoAberta, reagir, encerrarReacoes, celebiMovimento, celebiCaptura, celebiLider, celebiDuelo, aceitarTabela, celebiTabela, celebiDe, escolherLura, resolverFestival, resolverJuniper, resolverAzalea, distribuirEvento, comprarAqua, resolverMagma, est, desistirCaptura, vistaDe, PEND_PRIVADO, escolherDuelo, confirmarPreso, preso, noHexFinal, proporTroca, cancelarProposta, responderProposta, podeProporTroca, alvosProposta, trocavel, MAX_PROPOSTA, quemDecide, podeAgir, acao, posAcao, celebiPraca, reagirRepel, encerrarRepel, temRepel, ligaCelebi, ligaRemedio, responderCynthia, temCynthia, escolherDuplaPraca, fecharPraca, resolverPracaPremio, pracaAptosDe, pracaForca, PREMIOS_PRACA, iniciarLiga, ligaGatilho, resolverLigaOponente, ligaEscolher, ligaSeguir, ligaAptos, porCapturas, FASE_LIGA, resolverWally, wallyOk, resolverCriadores, opcoesCriadores, linhasCriadores, foraDeJogoCriadores, resolverFuchsia, resolverBriney, encrencado, escolherSlot, resolverTipoCor, pegarDeLista, escolherEspaco, escolherLiderFora, pagarItens, resolverNegociador, pegarItem, filtrarSlots, escolherDesempate, descartarDe, resolverTroca, resolverDividir, escolherOpcao, lutarDuelo, fecharDuelo, aptosDuelo, paresTroca, temBoneca, slotInsignia, vantagem, bonusItemBatalha, idx, P, ITEM, J, HW, HH, CORES_PEAO, TIPOS_NOME, ORDEM_FORCA
  };
})(window);
