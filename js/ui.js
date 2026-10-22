// Interface (modo local: todos jogam no mesmo navegador, passando a vez)
(function () {
  'use strict';
  const E = window.Engine, D = window.DATA;
  const $ = (s, el) => (el || document).querySelector(s);
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NS = 'http://www.w3.org/2000/svg';
  const SAVE = 'pmthex-partida-v1';
  const COR_HEX = { branco: '#f3f4f6', preto: '#1f2937', vermelho: '#e3202b', azul: '#2563eb', verde: '#16a34a', amarelo: '#facc15' };
  const COR_NOME = { branco: 'Branco', preto: 'Preto', vermelho: 'Vermelho', azul: 'Azul', verde: 'Verde', amarelo: 'Amarelo' };
  const CARD_W = E.HW * 0.148, CARD_H = CARD_W / 0.86;
  let st = null, view = null, boardMode = null, sel = {};
  const PREF = 'pmthex-prefs';
  let prefs = (() => { try { return Object.assign({ tema: 'escuro', velIA: 'normal' }, JSON.parse(localStorage.getItem(PREF)) || {}); } catch (e) { return { tema: 'escuro', velIA: 'normal' }; } })();
  function salvarPrefs() { try { localStorage.setItem(PREF, JSON.stringify(prefs)); } catch (e) {} }
  function aplicarTema() { document.documentElement.dataset.theme = prefs.tema === 'claro' ? 'light' : 'dark'; }
  aplicarTema();
  const VEL = { lenta: 1300, normal: 750, rapida: 250 };

  // ---------- persistência ----------
  function salvar() { if (typeof NET !== 'undefined' && NET.modo === 'cliente') return; try { localStorage.setItem(SAVE, JSON.stringify(st)); } catch (e) {} }
  function carregarSalvo() { try { return JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return null; } }
  function act(fn) { return (...a) => { fn(...a); salvar(); render(); }; }
  function run(fn, ...a) { fn(st, ...a); salvar(); render(); }
  // ---------- ações: tudo passa pelo despachante do motor ----------
  // NET.modo: 'local' (passa-e-joga), 'host' (anfitrião on-line) ou 'cliente'; NET.eu: o meu assento no on-line
  const NET = { modo: 'local', eu: null, enviar: null };
  const souAnfitriao = () => NET.modo !== 'cliente';
  const online = () => NET.modo !== 'local';
  const souEu = id => !online() || id === NET.eu; // este assento é jogado nesta tela?
  function agir(nome, ...a) {
    if (NET.modo === 'cliente') { if (NET.enviar) NET.enviar(nome, a); return; }
    const j = NET.modo === 'local' ? 'host' : NET.eu;
    if (E.acao(st, j, nome, ...a)) { salvar(); render(); if (NET.modo === 'host' && NET.difundir) NET.difundir(); }
  }
  // decisões da IA disparadas pela tela (na vez de um humano): só o anfitrião executa
  function agirIA(nome, ...a) { if (!souAnfitriao()) return; if (E.acao(st, 'host', nome, ...a)) { salvar(); render(); if (NET.modo === 'host' && NET.difundir) NET.difundir(); } }

  // ---------- abertura ----------
  function telaAbertura() {
    const salvo = carregarSalvo();
    const jog = [{ nome: prefs.nome || '', cor: 'vermelho' }, { nome: '', cor: 'azul' }];
    let modo = 'local';
    const box = $('#setup'); $('#game').hidden = true; box.hidden = false;
    const draw = () => {
      if (modo === 'online') jog.forEach((j, i) => { j.tipo = i === 0 ? 'eu' : (j.ia ? 'ia' : 'remoto'); });
      box.innerHTML = `<div class="setupCard">
        <div class="logo"><h1>Pokémon Master Trainer: <b>HEX</b></h1><span class="tag">versão web · protótipo</span></div>
        <div class="row modoTabs"><button class="${modo === 'local' ? 'pri' : ''}" data-modo="local">🏠 Local (mesmo navegador)</button><button class="${modo === 'online' ? 'pri' : ''}" data-modo="online">🌐 On-line (cada um no seu)</button></div>
        <p class="mut">${modo === 'local' ? 'Modo local: todos jogam neste navegador, passando a vez. De 2 a 6 jogadores — humanos ou controlados pelo computador (🤖).' : 'Modo on-line: você cria a sala e manda o link para os amigos. O primeiro lugar é o seu; os outros podem ser 🌐 jogadores on-line ou 🤖 IA (que roda no seu navegador).'}</p>
        ${salvo && salvo.online && salvo.vencedor == null ? `<div class="result" style="margin:10px 0">Há uma partida on-line salva (sala <b>${esc(salvo.online.codigo)}</b>). <button class="sm pri" id="retomar">🌐 Retomar a sala</button></div>` : ''}
        <h3 style="margin-top:18px">Jogadores</h3>
        <div id="pls"></div>
        <div class="row" style="margin-top:10px">
          <button id="addP" ${jog.length >= 6 ? 'disabled' : ''}>+ Jogador</button>
          <span class="mut" style="flex:1"></span>
          ${salvo ? '<button id="cont">Continuar partida salva</button>' : ''}
          <label class="row" style="gap:6px"><span class="mut">IA</span><select id="velIA">${Object.keys(VEL).map(v => `<option value="${v}" ${prefs.velIA === v ? 'selected' : ''}>${{ lenta: 'lenta', normal: 'normal', rapida: 'rápida' }[v]}</option>`).join('')}</select></label>
          <button class="sm" id="temaS" title="Alternar tema">${prefs.tema === 'claro' ? '🌙 Escuro' : '☀️ Claro'}</button>
          <label class="row" style="gap:6px"><span class="mut">Semente</span><input id="seed" placeholder="aleatória" style="width:110px"></label>
          <button class="pri" id="go">${modo === 'online' ? '🌐 Criar sala' : 'Começar partida'}</button>
        </div>
        <p class="mut" style="margin-top:14px;font-size:12px">Elenco: Balanceado (padrão). Liga: formato Mata-Mata. Avatares dos personagens chegam depois — por enquanto o peão é a cor.</p>
      </div>`;
      const pls = $('#pls');
      jog.forEach((j, i) => {
        const usadas = jog.filter((x, k) => k !== i).map(x => x.cor);
        const row = h(`<div class="pl"><span class="dot" style="background:${COR_HEX[j.cor]}"></span>
          <div class="row" style="flex-wrap:nowrap"><input value="${esc(j.nome)}" placeholder="${modo === 'online' ? (i === 0 ? 'Seu nome' : j.ia ? 'CPU ' + (i + 1) : 'nome escolhido por quem entrar') : j.ia ? 'CPU ' + (i + 1) : 'Jogador ' + (i + 1)}" style="flex:1" ${modo === 'online' && i > 0 && !j.ia ? 'disabled' : ''}>${modo === 'online' && i === 0 ? '<span class="tag">você · anfitrião</span>' : `<button class="sm iaTog ${j.ia ? 'on' : ''}" data-ia title="Controlado pelo computador">${j.ia ? '🤖 IA' : modo === 'online' ? '🌐 On-line' : '🙂 Humano'}</button>`}</div>
          <div class="row"><div class="swatches">${E.CORES_PEAO.map(c => `<span class="sw ${c === j.cor ? 'on' : ''} ${usadas.includes(c) ? 'taken' : ''}" data-c="${c}" title="${COR_NOME[c]}" style="background:${COR_HEX[c]}"></span>`).join('')}</div>
          ${jog.length > 2 ? `<button class="sm" data-rm>✕</button>` : ''}</div></div>`);
        $('input', row).oninput = e => { j.nome = e.target.value; if (i === 0) { prefs.nome = j.nome; salvarPrefs(); } };
        const tg = $('[data-ia]', row); if (tg) tg.onclick = () => { j.ia = !j.ia; draw(); };
        row.querySelectorAll('.sw').forEach(s => s.onclick = () => { if (!usadas.includes(s.dataset.c)) { j.cor = s.dataset.c; draw(); } });
        const rm = $('[data-rm]', row); if (rm) rm.onclick = () => { jog.splice(i, 1); draw(); };
        pls.appendChild(row);
      });
      $('#velIA').onchange = e => { prefs.velIA = e.target.value; salvarPrefs(); };
      $('#temaS').onclick = () => { prefs.tema = prefs.tema === 'claro' ? 'escuro' : 'claro'; salvarPrefs(); aplicarTema(); draw(); };
      $('#addP').onclick = () => { const livre = E.CORES_PEAO.find(c => !jog.some(j => j.cor === c)); jog.push({ nome: '', cor: livre, ia: true }); draw(); };
      box.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { modo = b.dataset.modo; if (modo === 'online') jog.forEach((j, i) => { if (i > 0 && j.ia === undefined) j.ia = false; }); draw(); });
      const rt = $('#retomar'); if (rt) rt.onclick = () => retomarSala(salvo);
      $('#go').onclick = () => {
        const sv = $('#seed').value.trim(); const seed = sv ? [...sv].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) : (Date.now() ^ (Math.random() * 1e9)) | 0;
        if (modo === 'online') { jog[0].nome = jog[0].nome.trim() || 'Anfitrião'; return criarSala(jog.map((j, i) => ({ nome: j.nome, cor: j.cor, tipo: i === 0 ? 'eu' : j.ia ? 'ia' : 'remoto', ia: !!j.ia && i > 0 })), seed); }
        st = E.novoJogo({ seed, jogadores: jog.map((j, i) => ({ nome: j.nome.trim() || (j.ia ? 'CPU ' + (i + 1) : 'Jogador ' + (i + 1)), cor: j.cor, ia: !!j.ia })) });
        salvar(); iniciarJogo();
      };
      const c = $('#cont'); if (c) c.onclick = () => { st = salvo; iniciarJogo(); };
    };
    draw();
  }

  // ---------- tabuleiro ----------
  function iniciarJogo() {
    rolVista = null; parqueVisto = null; movVisto = st && st.mov ? st.mov.seq : null; anim = null;
    $('#setup').hidden = true; $('#game').hidden = false;
    desenharHexes(); render(); setTimeout(() => focar(E.J(st).pos, 0.55), 30);
  }
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function desenharHexes() {
    const g = $('#lHex'); g.innerHTML = '';
    for (const [pos, hid] of Object.entries(st.layout)) {
      const o = E.posXY(pos), hx = D.hexes[hid];
      el('image', { href: hx.img, x: o.x, y: o.y, width: E.HW, height: E.HH, preserveAspectRatio: 'none' }, g);
    }
    view = null; enquadrar();
  }
  function bounds() { return { x: -60, y: -60, w: E.HW * 4.5 + 120, h: E.HH * 1.75 + 120 }; }
  function setView() { $('#board').setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); }
  function enquadrar() {
    const b = bounds(), r = $('#board').getBoundingClientRect(), s = Math.max(b.w / r.width, b.h / r.height);
    view = { w: r.width * s, h: r.height * s }; view.x = b.x + (b.w - view.w) / 2; view.y = b.y + (b.h - view.h) / 2; setView();
  }
  function focar(k, z) {
    const n = E.grafo(st).nodes[k]; if (!n) return; const r = $('#board').getBoundingClientRect(); const b = bounds();
    const s = Math.max(b.w / r.width, b.h / r.height) * (z || 0.6);
    view = { w: r.width * s, h: r.height * s }; view.x = n.wx - view.w / 2; view.y = n.wy - view.h / 2; setView();
  }
  function toWorld(ev) { const svg = $('#board'), p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  (function panzoom() {
    const svg = $('#board'); let drag = null;
    svg.addEventListener('wheel', ev => { ev.preventDefault(); const p = toWorld(ev), f = ev.deltaY > 0 ? 1.12 : 1 / 1.12; view.x = p.x - (p.x - view.x) * f; view.y = p.y - (p.y - view.y) * f; view.w *= f; view.h *= f; setView(); }, { passive: false });
    const toques = new Map(); let pinca = null, ultimoToque = 0;
    const zoomEm = (cx, cy, f) => { const p = toWorld({ clientX: cx, clientY: cy }); view.x = p.x - (p.x - view.x) * f; view.y = p.y - (p.y - view.y) * f; view.w *= f; view.h *= f; setView(); };
    svg.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'touch') {
        toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), v: Object.assign({}, view) }; drag = null; return; }
        if (!ev.target.closest('.dest,.slot,.pawn,.city')) { const agora = Date.now(); if (agora - ultimoToque < 300) { zoomEm(ev.clientX, ev.clientY, 1 / 1.8); ultimoToque = 0; return; } ultimoToque = agora; }
      }
      if (ev.target.closest('.dest,.slot,.pawn,.city')) return; drag = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y }; svg.classList.add('dragging'); try { svg.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    svg.addEventListener('pointermove', ev => {
      if (ev.pointerType === 'touch' && toques.has(ev.pointerId)) toques.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinca && toques.size >= 2) {
        const [a, b] = [...toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (!d) return;
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, f = pinca.d / d;
        view = Object.assign({}, pinca.v); const r = svg.getBoundingClientRect();
        const wx = view.x + (cx - r.left) / r.width * view.w, wy = view.y + (cy - r.top) / r.height * view.h;
        view.w = pinca.v.w * f; view.h = pinca.v.h * f; view.x = wx - (cx - r.left) / r.width * view.w; view.y = wy - (cy - r.top) / r.height * view.h; setView(); return;
      }
      if (!drag) return; const r = svg.getBoundingClientRect(), s = view.w / r.width; view.x = drag.vx - (ev.clientX - drag.x) * s; view.y = drag.vy - (ev.clientY - drag.y) * s; setView();
    });
    const soltar = ev => { toques.delete(ev.pointerId); if (toques.size < 2) pinca = null; drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
    window.addEventListener('resize', () => { if (st) enquadrar(); });
    // quando só a altura da área do tabuleiro muda (barra do celular), mantém o zoom e o centro, sem deixar faixas vazias
    let tamAnt = null;
    if (window.ResizeObserver) new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (!view || !r.width || !r.height) return; if (tamAnt && tamAnt.w === r.width) { const cy = view.y + view.h / 2; view.h = view.w * r.height / r.width; view.y = cy - view.h / 2; setView(); } tamAnt = { w: r.width, h: r.height }; }).observe(svg);
    $('#zoomFit').onclick = enquadrar; $('#zoomMe').onclick = () => focar((online() && NET.eu >= 0 ? E.J(st, NET.eu) : E.J(st)).pos, 0.55);
  })();

  function renderBoard() {
    $('#tip').hidden = true;
    const g = E.grafo(st), gS = $('#lSlots'), gP = $('#lSpaces'), gW = $('#lPawns');
    gS.innerHTML = gP.innerHTML = gW.innerHTML = '';
    const pd = st.pend;
    // cartas no tabuleiro
    Object.values(g.slots).forEach(s => {
      const c = st.slots[s.key]; if (!c || !c.carta) return;
      const pk = E.P(c.carta), x = s.wx - CARD_W / 2, y = s.wy - CARD_H / 2;
      const gg = el('g', { class: 'slot' + (boardMode && boardMode.tipo === 'slot' ? ' alvo' : '') }, gS);
      el('image', { href: c.aberta ? pk.img : D.versos[s.cor], x, y, width: CARD_W, height: CARD_H }, gg);
      el('rect', { class: 'frame', x, y, width: CARD_W, height: CARD_H, rx: 10, fill: 'none', stroke: '#000', 'stroke-width': 5 }, gg);
      if (c.fraco) {
        el('rect', { class: 'fracoBorda', x: x - 4, y: y - 4, width: CARD_W + 8, height: CARD_H + 8, rx: 14, fill: 'none', stroke: '#dc2626', 'stroke-width': 12 }, gg);
        const bx = x + CARD_W - 6, by = y + 6, sg = el('g', { class: 'fracoSelo' }, gg);
        el('circle', { cx: bx, cy: by, r: 36, fill: '#dc2626', stroke: '#fff', 'stroke-width': 6 }, sg);
        const t = el('text', { x: bx, y: by + 13, 'text-anchor': 'middle', fill: '#fff', 'font-size': 36, 'font-weight': 800, 'font-family': 'Inter, sans-serif' }, sg); t.textContent = '±1';
        const ti = el('title', {}, gg); ti.textContent = 'Enfraquecido: ±1 no dado de captura';
      }
      gg.addEventListener('click', ev => { ev.stopPropagation(); if (boardMode && boardMode.tipo === 'slot') { const cb = boardMode.cb; boardMode = null; cb(s.key); } else if (c.aberta) zoom(pk.img); });
    });
    // cidades: passar o mouse mostra o Líder; clicar abre os detalhes
    const eu = E.J(st);
    Object.entries(st.lideres).forEach(([k, lid]) => {
      const n = g.nodes[k]; if (!n) return; const L = E.idx().ld[lid];
      const w = E.HW * 0.27, hh = E.HH * 0.16;
      const r = el('rect', { class: 'city', x: n.wx - w / 2, y: n.wy - hh / 2, width: w, height: hh, rx: 14, fill: 'transparent' }, gP);
      r.addEventListener('pointerenter', ev => dica(ev, L, k)); r.addEventListener('pointermove', moverDica); r.addEventListener('pointerleave', () => $('#tip').hidden = true);
      r.addEventListener('click', ev => { ev.stopPropagation(); if (boardMode && boardMode.tipo === 'espaco') { const cb = boardMode.cb; boardMode = null; return cb(k); } modalLiderInfo(k); });
      const venc = st.jogadores.filter(q => q.lideresVencidos.includes(lid));
      venc.forEach((q, i) => { const cx = n.wx + w / 2 - 22 - i * 34, cy = n.wy - hh / 2 - 18; el('circle', { cx, cy, r: 18, fill: COR_HEX[q.cor], stroke: '#000', 'stroke-width': 4 }, gP); const t = el('text', { x: cx, y: cy + 9, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:26px;stroke-width:5px' }, gP); t.textContent = '✓'; });
    });
    // destinos destacados
    const marca = (k, cls, cb) => { const n = g.nodes[k]; const r = n.kind === 'cidade' ? 120 : 70; const c = el('circle', { class: 'dest ' + cls, cx: n.wx, cy: n.wy, r }, gP); c.addEventListener('click', ev => { ev.stopPropagation(); cb(k); }); };
    if (boardMode && boardMode.tipo === 'espaco') Object.values(g.nodes).filter(n => n.kind !== 'porta' && (!boardMode.filtro || boardMode.filtro.includes(n.key))).forEach(n => marca(n.key, 'alvo', k => { const cb = boardMode.cb; boardMode = null; cb(k); }));
    else if (boardMode && boardMode.tipo === 'trem') E.J(st).passou.filter(k => k !== E.J(st).pos).forEach(k => marca(k, 'trem', k => { boardMode = null; agir('trem', k); }));
    else if (st.fase === 'mover' && st.turno && st.turno.destinos && !pd && souEu(E.J(st).id)) Object.entries(st.turno.destinos).forEach(([k, info]) => marca(k, info.custo ? 'custo' : '', k => escolherDestino(k, info)));
    // peões
    const porEspaco = {}; st.jogadores.forEach(p => (porEspaco[p.pos] = porEspaco[p.pos] || []).push(p));
    Object.entries(porEspaco).forEach(([k, ps]) => {
      const n = g.nodes[k]; if (!n) return;
      ps.forEach((p, i) => {
        const ang = ps.length > 1 ? (i / ps.length) * Math.PI * 2 : 0, rr = ps.length > 1 ? 52 : 0;
        let x = n.wx + Math.cos(ang) * rr, y = n.wy + Math.sin(ang) * rr - 20;
        if (anim && anim.j === p.id) { const q = posAnim(); if (q) { x = q.x; y = q.y; } }
        const gg = el('g', { class: 'pawn' + (p.id === st.vez && st.vencedor == null ? ' vez' : ''), 'data-j': p.id, transform: `translate(${x},${y})` }, gW);
        if (p.id === st.vez && st.vencedor == null) el('circle', { class: 'pulso', r: 46 }, gg);
        el('ellipse', { cx: 0, cy: 46, rx: 34, ry: 12, fill: 'rgba(0,0,0,.45)' }, gg);
        el('circle', { r: 40, fill: COR_HEX[p.cor], stroke: p.id === st.vez ? '#ffcb05' : '#000', 'stroke-width': p.id === st.vez ? 10 : 6 }, gg);
        const t = el('text', { 'text-anchor': 'middle', y: 16, fill: ['branco', 'amarelo'].includes(p.cor) ? '#111' : '#fff' }, gg); t.textContent = rotulo(p);
      });
    });
    const hint = $('#boardHint');
    if (boardMode) { hint.hidden = false; hint.innerHTML = `<span>${esc(boardMode.msg)}</span>${boardMode.pend ? '' : '<button>cancelar</button>'}`; const hb = $('button', hint); if (hb) hb.onclick = () => { boardMode = null; render(); }; }
    else if (st.fase === 'mover' && st.turno.destinos && !pd && souEu(E.J(st).id)) { hint.hidden = false; hint.innerHTML = `<span>Escolha o destino no tabuleiro</span>`; }
    else hint.hidden = true;
  }
  // ---------- animação do peão: desliza espaço por espaço, com um pulinho em cada um ----------
  let anim = null, movVisto = null;
  const PASSO_MS = 190;
  function iniciarAnim() {
    const m = st && st.mov; if (!m || m.seq === movVisto) return;
    movVisto = m.seq;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const g = E.grafo(st), pts = m.cam.map(k => g.nodes[k]).filter(Boolean).map(n => ({ x: n.wx, y: n.wy - 20 }));
    if (pts.length < 2) return;
    anim = { seq: m.seq, j: m.j, pts, t0: performance.now(), dur: Math.min(3000, Math.max(350, (pts.length - 1) * (m.trem ? 700 : PASSO_MS))) };
    const passo = () => {
      if (!anim) return; const q = posAnim(), gp = document.querySelector(`#lPawns .pawn[data-j="${anim.j}"]`);
      if (gp && q) gp.setAttribute('transform', `translate(${q.x},${q.y})`);
      if (performance.now() - anim.t0 >= anim.dur) { anim = null; render(); return; }
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }
  function posAnim() {
    if (!anim) return null; const f = Math.min(1, (performance.now() - anim.t0) / anim.dur), n = anim.pts.length - 1;
    const pos = f * n, i = Math.min(n - 1, Math.floor(pos)), t = pos - i, a = anim.pts[i], b = anim.pts[i + 1];
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // suave em cada passo
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e - Math.sin(Math.PI * t) * 28 };
  }
  function rotulo(p) { const ini = q => q.nome.trim().slice(0, 1).toUpperCase(); const rep = st.jogadores.filter(q => ini(q) === ini(p)).length > 1; return rep ? (p.nome.match(/\d+\s*$/) ? p.nome.match(/\d+\s*$/)[0].trim() : ini(p) + (p.id + 1)) : ini(p); }
  function escolherDestino(k, info) {
    if (info.custo) {
      const p = E.J(st);
      abrirModal(`<h2>Passagem de Item</h2><p>Para entrar neste espaço você precisa descartar <b>${info.custo}</b> Item(ns). Escolha quais:</p>
        <div class="hand" id="pay">${p.itens.map(i => `<div class="ic" data-i="${i}"><img src="${E.ITEM(i).img}"></div>`).join('')}</div>
        <div class="mfoot"><button data-x>Voltar</button><button class="pri" id="payOk" disabled>Pagar e entrar</button></div>`);
      const esc2 = []; $('#pay').querySelectorAll('.ic').forEach(c => c.onclick = () => { const i = c.dataset.i; const at = esc2.indexOf(i); if (at >= 0) esc2.splice(at, 1); else if (esc2.length < info.custo) esc2.push(i); c.classList.toggle('sel', esc2.includes(i)); $('#payOk').disabled = esc2.length !== info.custo; });
      $('#payOk').onclick = () => { fecharModal(); agir('mover', k, esc2); };
      return;
    }
    agir('mover', k);
  }

  // ---------- painéis ----------
  const CORES_ORDEM = ['inicial', 'rosa', 'verde', 'azul', 'vermelho', 'amarelo'];
  function cartaPokemon(p, id, extra) {
    const c = E.P(id), f = E.forcaBase(p, id) + E.bonusTreinador(p, id), ob = E.obedece(p, c.cor);
    return `<div class="pc ${ob ? '' : 'off'} ${p.mais1 && p.mais1[id] ? 'gs' : ''} ${extra || ''}" data-id="${id}" title="${esc(c.nome)} — força ${f}${ob ? '' : ' (ainda não obedece)'}${p.mais1 && p.mais1[id] ? ' · marcador +1 da Bola GS' : ''}">
      <img src="${c.img}" loading="lazy">${E.familiaTravada(p, id) ? '<img class="lock" src="img/ui/plus1.webp">' : ''}${p.mais1 && p.mais1[id] ? `<span class="gsTag" title="Marcador +1 permanente (Bola GS)">GS +${p.mais1[id]}</span>` : ''}<span class="f">${f}</span></div>`;
  }
  // Time agrupado por linha evolutiva: famílias com 2+ Pokémons ganham uma moldura compartilhada
  // opts.ids: só estes Pokémons (o bônus continua calculado com o time todo); opts.carta: como desenhar cada carta
  function timeAgrupado(p, larg, opts) {
    opts = opts || {}; const carta = opts.carta || (id => cartaPokemon(p, id)), bonusDe = opts.bonus || (id => E.bonusEvolucao(p, id));
    const grupos = {};
    (opts.ids || p.pokemon).forEach(id => { const c = E.P(id), k = c.familia || id; (grupos[k] = grupos[k] || []).push(id); });
    const ordemCor = ids => Math.max(...ids.map(id => CORES_ORDEM.indexOf(E.P(id).cor)));
    const lista = Object.entries(grupos).map(([fam, ids]) => ({ fam, ids: ids.sort((a, b) => E.P(a).estagio - E.P(b).estagio || CORES_ORDEM.indexOf(E.P(a).cor) - CORES_ORDEM.indexOf(E.P(b).cor)) }))
      .sort((a, b) => (b.ids.length > 1) - (a.ids.length > 1) || ordemCor(a.ids) - ordemCor(b.ids) || E.P(a.ids[0]).nome.localeCompare(E.P(b.ids[0]).nome));
    return `<div class="team2" style="--w:${larg || 62}px">${lista.map(g => {
      if (g.ids.length === 1) return `<div class="famG solo">${carta(g.ids[0])}</div>`;
      const trav = p.travadas.includes(g.fam), bonus = Math.max(...g.ids.map(bonusDe));
      return `<div class="famG ${trav ? 'trav' : ''}" title="Linha evolutiva${bonus ? ` — bônus de evolução +${bonus} no mais evoluído` : ''}${trav ? ' · família travada (+1)' : ''}"><span class="famTag">${trav ? '🔒 ' : ''}${bonus ? 'evol. +' + bonus : 'mesma linha'}</span>${g.ids.map(id => carta(id)).join('')}</div>`;
    }).join('')}</div>`;
  }
  const PREMIO_INSIGNIA = ['Pokémons Azuis obedecem', 'Pokémons Vermelhos obedecem', 'ganhe um Pokémon Azul', 'Pokémons Amarelos obedecem', 'ganhe um Pokémon Vermelho', 'trave e melhore (+1) uma família'];
  function insignias(p, mini) {
    return `<div class="badges">${p.insignias.map((l, i) => l ? `<span class="badge" title="${esc(E.idx().ld[l].nome)} (Insígnia ${i + 1} — ${PREMIO_INSIGNIA[i]})"><img src="${E.idx().ld[l].img}"></span>` : `<span class="badge" title="Insígnia ${i + 1} — ${PREMIO_INSIGNIA[i]} (ainda não conquistada)">${mini ? '' : i + 1}</span>`).join('')}</div>`;
  }
  function render() {
    if (!st) return;
    iniciarAnim();
    renderBoard();
    const p = E.J(st), t = st.turno || {};
    // --- turno ---
    const tb = $('#turnBox');
    const tr = p.treinador && E.idx().tr[p.treinador];
    const L = st.lideres[p.pos] && E.idx().ld[st.lideres[p.pos]];
    const noCidade = E.grafo(st).nodes[p.pos].kind === 'cidade' || E.grafo(st).nodes[p.pos].especial === 'planalto';
    const cordas = p.itens.filter(i => ['corda', 'escaperope'].includes(i.split('#')[0]));
    let acoes = '';
    if (st.fase === 'inicio') {
      acoes += `<button class="pri" data-a="rolar">🎲 Rolar dado</button>`;
      if (tr && tr.efeito === 'hiker') acoes += `<button data-a="hiker">Hiker: andar até 2</button>`;
      if (noCidade && p.passou.length > 1) acoes += `<button data-a="trem">🚆 Trem</button>`;
      if (tr && tr.efeito === 'lyra') acoes += `<button data-a="lyra">Lyra: pular e comprar 2 Itens</button>`;
    }
    if (st.fase === 'mover' && t.dados && t.dados.length > 1 && t.rolagem == null) acoes += `<span class="mut">Green: escolha um dos dados acima.</span>`;
    if (st.fase === 'mover' && t.dados && E.celebiDe(p) && !p.ia) acoes += t.dados.length > 1 ? t.dados.map((d, k) => `<button class="sm celebi" data-celebi="${k}">🌸 Celebi: refazer ${k + 1}º (${d})</button>`).join('') : `<button class="sm celebi" data-celebi="0">🌸 Celebi: refazer o dado</button>`;
    if (st.fase === 'mover' && t.rolagem != null) cordas.forEach(i => { const it = E.ITEM(i), m = it.id === 'corda' ? 1 : 2; for (let d = -m; d <= m; d++) if (d) acoes += `<button class="sm" data-corda="${i}" data-d="${d}">Corda ${d > 0 ? '+' : ''}${d}</button>`; });
    if (L && !t.batalhouLider && st.fase !== 'mover' && E.podeEnfrentar(p, L)) acoes += `<button data-a="lider">⚔ Enfrentar ${esc(L.nome)}</button>`;
    if (st.fase !== 'mover') acoes += `<button data-a="fim" ${E.podeEncerrar(st) ? '' : 'disabled'}>Encerrar turno ▸</button>`;
    if (p.ia) acoes = `<span class="mut">🤖 ${esc(p.nome)} está jogando…</span>${souAnfitriao() ? `<button class="sm" id="pausa">${pausado ? '▶ Retomar IA' : '⏸ Pausar IA'}</button>` : ''}`;
    else if (online() && p.id !== NET.eu) acoes = `<span class="mut">⏳ Vez de ${esc(p.nome)}…</span>`;
    tb.innerHTML = `<div class="turnHead"><span class="dot" style="background:${COR_HEX[p.cor]}"></span><h2>${esc(p.nome)}${p.ia ? ' <span class="tag">🤖 IA</span>' : ''}</h2><span class="tag">Rodada ${st.rodada}</span><button class="gear" id="btnCfg" title="Configurações">⚙</button></div>
      <div class="mut" style="margin-bottom:6px">📍 ${esc(E.nomeEspaco(st, p.pos))}${p.pular ? ` · perde ${p.pular} turno(s)` : ''}</div>
      ${L ? `<div class="ldline" data-ld="${p.pos}"><img src="${L.img}"><div><b>${esc(L.nome)}</b> · força ${L.forca}${L.dual ? ' · DUAL' : ''}<br><span class="mut">${E.TIPOS_NOME[L.tipo]} · insígnia ${L.insignias}${p.lideresVencidos.includes(L.id) ? ' · <b style="color:var(--ok)">vencido</b>' : ''}</span></div></div>` : ''}
      ${t.dados ? `<div class="dice">${(() => { let usado = false; return t.dados.map(d => { const esc0 = t.dados.length > 1 && t.rolagem == null; const este = t.dados.length > 1 && t.rolagem != null && !usado && (d === t.rolagem || d === t.escolhido); if (este) usado = true; return `<div class="die ${esc0 ? 'escolher' : ''} ${t.dados.length > 1 && t.rolagem != null ? (este ? 'usado' : 'off') : ''}" data-d="${d}">${d}</div>`; }).join(''); })()}${t.rolagem != null && !t.dados.includes(t.rolagem) || (t.rolagem != null && t.dados.length === 1 && t.rolagem !== t.dados[0]) ? `<span class="mut">→ ${t.rolagem}</span>` : ''}</div>` : ''}
      ${(st.efeitos || []).length ? `<div class="efeitos">${st.efeitos.map(e => `<span class="tag" title="Ativado por ${esc(E.J(st, e.dono).nome)}">⏳ ${esc(e.nome)} · ${esc(E.J(st, e.dono).nome)} · ${e.rest} rodada${e.rest > 1 ? 's' : ''}${e.tipo === 'parque' ? ' · ' + st.jogadores.filter(q => (e.ganhos[q.id] || []).length).map(q => esc(q.nome) + ' ' + e.ganhos[q.id].length).join(', ') : ''}</span>`).join(' ')}</div>` : ''}
      ${st.liga ? `<div class="ligaLine"><span>🏆 ${resumoLiga()}</span><button class="sm" id="btnLiga">Chaveamento</button></div>` : ''}
      <div class="actions">${st.vencedor != null ? `<b>👑 Fim de jogo — ${esc(E.J(st, st.vencedor).nome)} é o Mestre Pokémon.</b>` : acoes}</div>`;
    const bl = $('#btnLiga', tb); if (bl) bl.onclick = modalLiga;
    $('#btnCfg', tb).onclick = modalConfig;
    const pz = $('#pausa', tb); if (pz) pz.onclick = () => { pausado = !pausado; render(); };
    tb.querySelectorAll('[data-ld]').forEach(d => d.onclick = () => modalLiderInfo(d.dataset.ld));
    tb.querySelectorAll('.die.escolher').forEach(d => d.onclick = () => agir('escolherDado', +d.dataset.d));
    tb.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'rolar') agir('rolarMovimento'); else if (a === 'hiker') agir('hiker'); else if (a === 'lyra') agir('lyra');
      else if (a === 'trem') { boardMode = { tipo: 'trem', msg: 'Escolha uma cidade já visitada para ir de Trem' }; enquadrar(); render(); }
      else if (a === 'lider') agir('abrirLider');
      else if (a === 'fim') { agir('encerrarTurno'); if (!st.pend) setTimeout(() => focar(E.J(st).pos, 0.55), 20); }
    });
    tb.querySelectorAll('[data-celebi]').forEach(b => b.onclick = () => agir('celebiMovimento', +b.dataset.celebi));
    tb.querySelectorAll('[data-corda]').forEach(b => b.onclick = () => agir('ajustarRolagem', +b.dataset.d, b.dataset.corda));
    // --- minha ficha ---
    const mb = $('#meBox');
    const pm = online() ? (NET.eu != null && NET.eu >= 0 ? E.J(st, NET.eu) : null) : p, trm = pm && pm.treinador && E.idx().tr[pm.treinador];
    mb.innerHTML = !pm ? '<h3>Assistindo</h3><p class="mut">👀 Você está assistindo a esta partida.</p>' : `${online() ? `<h3>Você: <span class="dot" style="display:inline-block;vertical-align:middle;background:${COR_HEX[pm.cor]}"></span> ${esc(pm.nome)}</h3>` : ''}
      ${secao('time', `Time (${pm.pokemon.length})`, timeAgrupado(pm))}
      ${secao('itens', `Itens (${pm.itens.length}/${E.limiteItens(pm)})`, `<div class="hand">${pm.itens.map(i => `<div class="ic" data-i="${i}" title="${esc(E.ITEM(i).nome)}"><img src="${E.ITEM(i).img}"></div>`).join('') || '<span class="mut">Nenhum</span>'}</div>`)}
      ${secao('treinador', `Treinador${trm ? ': ' + esc(trm.nome) : ''}`, trm ? `<div class="trainer"><img src="${trm.img}" data-z="${trm.img}"><div><b>${esc(trm.nome)}</b><p>${esc(trm.texto)}</p></div></div>` : '<span class="mut">—</span>')}`;
    mb.querySelectorAll('.pc').forEach(c => c.onclick = () => zoom(E.P(c.dataset.id).img));
    mb.querySelectorAll('[data-z]').forEach(c => c.onclick = () => zoom(c.dataset.z));
    mb.querySelectorAll('.ic').forEach(c => c.onclick = () => modalItem(c.dataset.i));
    // --- outros ---
    $('#othersBox').innerHTML = secao('jogadores', 'Jogadores', st.jogadores.map(q => `<div class="other ${q.id === st.vez ? 'cur' : ''} ${q.eliminado ? 'elim' : ''}" data-p="${q.id}"><span class="dot" style="background:${COR_HEX[q.cor]}"></span><span style="flex:1">${esc(q.nome)}${online() && q.id === NET.eu ? ' <span class="tag">você</span>' : ''}${online() && q.remoto && !q.ia && !(NET.conectados || []).includes(q.id) ? ' <span title="desconectado">🔌</span>' : ''}${q.eliminado ? ' <span class="mut">· eliminado</span>' : st.vencedor === q.id ? ' 👑' : ''}</span><span class="mut cnt" title="${q.pokemon.length} Pokémon · ${q.itens.length} Itens">${q.pokemon.length} <img src="img/ui/pokebola.webp" alt="Pokémon"> · ${q.itens.length} <img src="img/ui/item.webp" alt="Itens"></span>${insignias(q, true)}</div>`).join(''));
    $('#othersBox').querySelectorAll('.other').forEach(o => o.onclick = () => modalJogador(+o.dataset.p));
    // --- registro ---
    const lg = $('#log'); const fundo = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 30;
    lg.innerHTML = st.log.slice(-120).map(l => `<div class="${l.tipo}">${logHtml(l)}</div>`).join(''); if (fundo) lg.scrollTop = lg.scrollHeight;
    ligarRefs(lg);
    // --- pendências (esperam o peão terminar de andar) ---
    if (anim) return;
    renderPend();
    avisarVez();
    verRolagem();
    verParque();
    agendarIA();
  }

  function ligarRefs(box) { box.querySelectorAll('.ref').forEach(r => { r.onmouseenter = ev => dicaCarta(ev, r.dataset.t, r.dataset.id); r.onmousemove = moverDica; r.onmouseleave = () => $('#tip').hidden = true; r.onclick = () => { $('#tip').hidden = true; zoom(refCarta(r.dataset.t, r.dataset.id).img); }; }); }
  function fecharExtra() { fecharModal(); if (st && st.pend) render(); }
  function modalLog() {
    abrirModal(`<h2>📜 Registro da partida</h2><p class="mut">Passe o mouse nos nomes sublinhados para ver a carta; clique para ampliar.</p>
      <div class="logFull">${st.log.map(l => `<div class="${l.tipo}"><span class="rd">R${l.t}</span> ${logHtml(l)}</div>`).join('')}</div>
      <div class="mfoot"><button class="pri" id="lgOk">Fechar</button></div>`);
    const lf = $('#modalCard .logFull'); ligarRefs(lf); lf.scrollTop = lf.scrollHeight; $('#lgOk').onclick = fecharExtra;
  }
  // ---------- configurações (engrenagem) ----------
  function modalConfig() {
    const anf = souAnfitriao();
    abrirModal(`<h2>⚙ Configurações</h2>
      <div class="cfgGrid">
        <fieldset><legend>Jogo</legend><button id="cLid">🏅 Líderes em jogo</button><button id="cLog">📜 Registro completo</button></fieldset>
        <fieldset><legend>Aparência</legend><button id="cTema">${prefs.tema === 'claro' ? '🌙 Tema escuro' : '☀️ Tema claro'}</button>${anf ? `<label class="row" style="gap:6px"><span class="mut">Velocidade da IA</span><select id="cVel">${Object.keys(VEL).map(v => `<option value="${v}" ${prefs.velIA === v ? 'selected' : ''}>${{ lenta: 'lenta', normal: 'normal', rapida: 'rápida' }[v]}</option>`).join('')}</select></label>` : ''}</fieldset>
        ${anf ? `<fieldset><legend>Partida${NET.modo === 'host' ? ' (anfitrião)' : ''}</legend><button id="cTools">🧰 Caixa de ferramentas</button><button id="cIA">🤖 Alternar humano/IA da vez</button>
          <button id="cExp">💾 Exportar partida (.json)</button><label class="row" style="margin-top:2px"><span class="mut">Importar:</span><input type="file" id="cImp" accept=".json" style="flex:1"></label>
          <button id="cNova">↩ Voltar à tela inicial</button></fieldset>` : `<fieldset><legend>Sala ${esc(C.codigo || '')}</legend><button id="cSair">↩ Sair da sala</button></fieldset>`}
      </div><p class="mut" style="font-size:12px">${anf ? 'A partida é salva automaticamente neste navegador.' : 'Você está jogando na sala de outra pessoa; a partida fica salva no navegador do anfitrião.'}</p>
      <div class="mfoot"><button class="pri" id="cOk">Fechar</button></div>`);
    const on = (id, f) => { const b = $('#' + id); if (b) b.onclick = f; };
    on('cOk', fecharExtra);
    on('cLid', () => modalLideres());
    on('cLog', () => modalLog());
    on('cTema', () => { prefs.tema = prefs.tema === 'claro' ? 'escuro' : 'claro'; salvarPrefs(); aplicarTema(); modalConfig(); });
    const vel = $('#cVel'); if (vel) vel.onchange = e => { prefs.velIA = e.target.value; salvarPrefs(); };
    on('cTools', () => caixaFerramentas());
    on('cIA', () => { const q = E.J(st); q.ia = !q.ia; salvar(); fecharExtra(); render(); if (NET.difundir) NET.difundir(); });
    on('cExp', () => { const b = new Blob([JSON.stringify(st)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pmthex-partida.json'; a.click(); });
    const imp = $('#cImp'); if (imp) imp.onchange = async e => { try { st = JSON.parse(await e.target.files[0].text()); salvar(); fecharModal(); iniciarJogo(); } catch (er) { alert('Arquivo inválido.'); } };
    on('cNova', () => { if (confirm('Sair desta partida? (ela continua salva até você começar outra)')) { fecharModal(); st = null; telaAbertura(); } });
    on('cSair', () => { if (confirm('Sair da sala? Você pode voltar pelo mesmo link.')) location.href = location.pathname; });
  }
  // ---------- seções recolhíveis do painel (lembradas neste navegador) ----------
  function secao(k, titulo, corpo) { const f = (prefs.recolhidas || {})[k]; return `<div class="sec ${f ? 'fechada' : ''}" data-sec="${k}"><h3 class="secHead" title="Clique para ${f ? 'mostrar' : 'recolher'}">${titulo}<span class="seta">▾</span></h3><div class="secBody">${corpo}</div></div>`; }
  document.addEventListener('click', e => {
    const hd = e.target.closest('.secHead'); if (!hd || e.target.closest('button')) return;
    const sc = hd.closest('[data-sec]'); if (!sc) return; const k = sc.dataset.sec;
    prefs.recolhidas = prefs.recolhidas || {}; prefs.recolhidas[k] = !prefs.recolhidas[k]; salvarPrefs();
    sc.classList.toggle('fechada', !!prefs.recolhidas[k]); hd.title = 'Clique para ' + (prefs.recolhidas[k] ? 'mostrar' : 'recolher');
  });
  // ---------- aviso de vez / decisão (on-line): toast e título da aba piscando se estiver em outra aba ----------
  const TITULO = document.title; let piscar = null, avisoAnt = { vez: false, dec: false };
  function piscarTitulo(msg) {
    if (!document.hidden || piscar) return; let on = false;
    piscar = setInterval(() => { on = !on; document.title = on ? msg : TITULO; }, 900);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && piscar) { clearInterval(piscar); piscar = null; document.title = TITULO; } });
  function avisarVez() {
    if (!online() || !st || NET.eu == null || NET.eu < 0 || st.vencedor != null) { avisoAnt = { vez: false, dec: false }; return; }
    const vez = st.vez === NET.eu && st.fase === 'inicio' && !st.pend;
    const dec = !!st.pend && E.quemDecide(st).includes(NET.eu) && !(st.pend.tipo === 'carta' && !E.reacaoAberta(st) && st.vez === NET.eu);
    if (vez && !avisoAnt.vez) { toast('🎲 Sua vez!'); piscarTitulo('🎲 Sua vez! — PMT HEX'); }
    else if (dec && !avisoAnt.dec && st.vez !== NET.eu) { toast('⚠ Uma decisão sua está esperando'); piscarTitulo('⚠ Sua decisão — PMT HEX'); }
    avisoAnt = { vez, dec };
  }
  // ---------- modais ----------
  function abrirModal(html) { $('#tip').hidden = true; const mc = $('#modalCard'); mc.classList.remove('ia', 'leitura'); if (!st || !st.pend) delete mc.dataset.pend; mc.innerHTML = html; $('#modal').hidden = false; $('#modalCard').querySelectorAll('[data-x]').forEach(b => b.onclick = fecharModal); }
  function fecharModal() { const mc = $('#modalCard'); $('#modal').hidden = true; mc.innerHTML = ''; mc.classList.remove('ia'); delete mc.dataset.pend; if (st) setTimeout(agendarIA, 0); }
  // janelas informativas (sem decisão pendente) fecham com Esc ou clicando fora
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modalCard').dataset.pend) fecharModal(); });
  function zoom(src) { const z = $('#zoomCard'); z.innerHTML = `<img src="${src}">`; z.hidden = false; z.onclick = () => z.hidden = true; }
  const faces = (cap) => `<div class="faces">${[1, 2, 3, 4, 5, 6].map(n => `<span class="face ${cap.includes(n) ? '' : 'off'}">${n}</span>`).join('')}</div>`;

  function renderPend() {
    const pd = st.pend;
    if (!pd) { if ($('#modalCard').dataset.pend) { delete $('#modalCard').dataset.pend; fecharModal(); } return; }
    $('#modalCard').dataset.pend = pd.tipo;
    const p = E.J(st);
    const decide = E.quemDecide(st), leitura = online() && !decide.includes(NET.eu);
    const nomesDec = decide.map(j => esc(E.J(st, j).nome)).join(' e ');
    if (leitura && (pd.privado || E.PEND_PRIVADO.has(pd.tipo) || pd.tipo === 'espaco')) { abrirModal(`<h2>${esc(pd.titulo || 'Decisão')}</h2><p class="mut">⏳ ${nomesDec || 'Outro jogador'} está decidindo…</p>`); $('#modalCard').classList.add('leitura'); return; }
    const humanoNoDuelo = (pd.tipo === 'duelo' && !E.J(st, pd.b).ia) || (pd.tipo === 'ligaBatalha' && [pd.a, pd.b].some(j => !E.J(st, j).ia)) || (pd.tipo === 'ligaOponente' && !E.J(st, pd.escolhe).ia) || pd.tipo === 'campeao' || (pd.tipo === 'cynthia' && !E.J(st, pd.respondente).ia) || (pd.tipo === 'praca' && [pd.a, pd.b].some(j => !E.J(st, j).ia));
    const iaEsperando = p.ia && ((pd.tipo === 'festival' && !E.J(st, pd.jogador).ia) || (pd.tipo === 'juniper' && !E.J(st, pd.doador).ia) || (pd.tipo === 'treinador' && !E.J(st, pd.jogador).ia) || (pd.tipo === 'carta' && esperandoHumano) || (pd.tipo === 'boneca' && !E.J(st, pd.respondente).ia) || (pd.tipo === 'briney' && !E.J(st, pd.dono).ia) || humanoNoDuelo);
    setTimeout(() => {
      const mc = $('#modalCard'); mc.classList.toggle('ia', p.ia && !iaEsperando); mc.classList.toggle('leitura', leitura);
      const old = $('.iaBanner', mc); if (old) old.remove();
      if (leitura && !['repel'].includes(pd.tipo) && !(pd.tipo === 'carta' && E.reacaoAberta(st))) { mc.prepend(h(`<div class="iaBanner">⏳ Aguardando ${nomesDec}…</div>`)); return; }
      if (p.ia && !E.reacaoAberta(st) && pd.tipo !== 'repel') mc.prepend(h(`<div class="iaBanner">${iaEsperando ? (pd.tipo === 'carta' ? `🤖 Vez de ${esc(p.nome)}: esta carta tem efeito manual. Aplique o que faltar pela caixa de ferramentas e clique em <b>Concluir</b>.` : `🤖 ${esc(p.nome)} envolveu você — sua decisão.`) : `🤖 ${esc(p.nome)} está decidindo…`}</div>`));
    }, 0);
    if (pd.tipo === 'captura') return mCaptura(pd, p);
    if (pd.tipo === 'carta') return mCarta(pd, p);
    if (pd.tipo === 'escolherCaptura') return mEscolher(pd, pd.cartas.map(id => ({ id, img: E.P(id).img })), id => agir('escolherCaptura', id), 'Escolha qual tentar capturar');
    if (pd.tipo === 'escolherEvento') return mEscolher(pd, pd.cartas.map(id => ({ id, img: E.idx().ev[id].img })), id => agir('escolherEvento', id), 'Escolha o Evento a ativar');
    if (pd.tipo === 'treinador' && E.J(st, pd.jogador).ia && !p.ia) { const q = E.J(st, pd.jogador); if (!treinTimer) treinTimer = setTimeout(() => { treinTimer = null; if (st.pend && st.pend.tipo === 'treinador') agirIA('escolherTreinador', window.AI.decidirTreinador(st)); }, 700); return abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(q.nome)} está escolhendo o Treinador…</p>`); }
    if (pd.tipo === 'treinador') { const q = E.J(st, pd.jogador); if (q.id !== p.id) pd.titulo = `${q.nome}: escolha seu Treinador`; const op = [q.treinador, ...q.treinadoresExtra].filter(Boolean); return mEscolher(pd, op.map(id => ({ id, img: E.idx().tr[id].img })), id => agir('escolherTreinador', id), 'Você só pode manter um Treinador ativo'); }
    if (pd.tipo === 'travar') return mTravar(pd);
    if (pd.tipo === 'lider') return mLider(pd, p);
    if (pd.tipo === 'descartar') return mDescartar(pd, p);
    if (pd.tipo === 'alvo') return mAlvo(pd, p);
    if (pd.tipo === 'tabelaRes') {
      if (p.ia) return abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(p.nome)} está decidindo…</p>`);
      abrirModal(`<h2>🎲 ${esc(pd.titulo)}</h2><div class="rolling final"><div class="die3d parou ${pd.ok ? 'ok' : 'no'}"><span>${pd.valor}</span></div><div class="result ${pd.ok ? 'ok' : 'no'}" style="margin:0;flex:1"><b class="big">${pd.valor}</b>${esc(pd.texto)}</div></div>
        <p class="mut">Você tem um Pedido a Celebi: pode descartá-lo para rolar de novo.</p>
        <div class="mfoot"><button class="celebi" id="tcel">🌸 Pedido a Celebi: rolar de novo</button><button class="pri" id="tok">Aceitar resultado</button></div>`);
      $('#tcel').onclick = () => agir('celebiTabela'); $('#tok').onclick = () => agir('aceitarTabela'); return;
    }
    if (pd.tipo === 'festival') {
      const q = E.J(st, pd.jogador);
      if (q.ia && !p.ia) { if (!festTimer) festTimer = setTimeout(() => { festTimer = null; if (st.pend && st.pend.tipo === 'festival') agirIA('resolverFestival', window.AI.decidirFestival(st)); }, 700); return abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(q.nome)} está decidindo…</p>`); }
      abrirModal(`<h2>🎪 ${esc(pd.titulo)}</h2>${q.id !== p.id ? `<p class="mut">Passe o dispositivo para ${esc(q.nome)}.</p>` : ''}<p class="mut">Clique num Pokémon para devolvê-lo e receber outro aleatório da mesma cor.</p>
        <div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">${q.pokemon.filter(id => !pd.trocados.includes(id) && st.decks[E.P(id).cor] && st.decks[E.P(id).cor].length).map(id => cartaPokemon(q, id)).join('')}</div>
        <div class="mfoot"><button class="pri" id="fs">${pd.restam > 1 ? 'Não trocar' : 'Pronto'}</button></div>`);
      $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('resolverFestival', c.dataset.id));
      $('#fs').onclick = () => agir('resolverFestival', null); return;
    }
    if (pd.tipo === 'juniper') {
      const d = E.J(st, pd.doador);
      if (d.ia && !p.ia) { if (!junTimer) junTimer = setTimeout(() => { junTimer = null; if (st.pend && st.pend.tipo === 'juniper') agirIA('resolverJuniper', window.AI.decidirJuniper(st)); }, 700); return abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(d.nome)} está escolhendo…</p>`); }
      abrirModal(`<h2>${esc(pd.titulo)}</h2>${d.id !== p.id ? `<p class="mut">Passe o dispositivo para ${esc(d.nome)}.</p>` : ''}<p class="mut">Depois da troca de presentes, os dois ganham um Pokémon Rosa.</p>
        <div class="hand">${d.itens.map(i => `<div class="ic" data-i="${i}" title="${esc(E.ITEM(i).nome)}" style="width:96px"><img src="${E.ITEM(i).img}"></div>`).join('')}</div>`);
      $('#modalCard').querySelectorAll('.ic').forEach(c => c.onclick = () => agir('resolverJuniper', c.dataset.i)); return;
    }
    if (pd.tipo === 'azalea') return mEscolher(pd, pd.cartas.map(id => ({ id, img: E.idx().ev[id].img })), id => agir('resolverAzalea', id), 'Clique no Evento que VOCÊ vai ativar; depois escolha o oponente que ativa o outro');
    if (pd.tipo === 'fuchsia') return mEscolher(pd, pd.cartas.map(id => ({ id, img: E.P(id).img })), id => agir('resolverFuchsia', id), 'O outro vai para o jogador com menos capturas');
    if (pd.tipo === 'distribuir') {
      const D0 = sel.dist && pd.cartas.includes(sel.dist) ? sel.dist : null, IX = pd.baralho === 'superevento' ? E.idx().sev : E.idx().ev;
      const livres = pd.jogadores.filter(j => pd.atribuido[j] == null);
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">1) Clique num ${pd.baralho === 'superevento' ? 'Super Evento' : 'Evento'} · 2) clique no jogador que vai ativá-lo. Cada jogador recebe no máximo um.${Object.keys(pd.atribuido).length ? ' Já definidos: ' + Object.entries(pd.atribuido).map(([j, c]) => esc(E.J(st, +j).nome) + ' → ' + esc(IX[c].nome)).join(', ') + '.' : ''}</p>
        <div class="pick">${pd.cartas.map(id => `<div class="pc ${D0 === id ? 'sel' : ''}" data-id="${id}"><img src="${IX[id].img}"></div>`).join('')}</div>
        <div style="display:grid;gap:8px;margin-top:14px">${livres.map(j => linhaJogador(E.J(st, j), j === p.id ? '<span class="tag">você</span>' : '')).join('')}</div>`);
      $('#modalCard').querySelectorAll('.pick .pc').forEach(c => c.onclick = () => { sel.dist = c.dataset.id; render(); });
      $('#modalCard').querySelectorAll('.pj').forEach(c => c.onclick = () => { if (!D0) return; sel.dist = null; agir('distribuirEvento', +c.dataset.p, D0); });
      return;
    }
    if (pd.tipo === 'wally') {
      if (p.ia) { abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(p.nome)} está escolhendo…</p>`); return; }
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">${esc(p.nome)}, clique num Item da sua mão para descartar e comprar ${pd.n + 1} em vez de ${pd.n}, ou compre normalmente.</p>
        <div class="pick">${p.itens.map(id => `<div class="pc" data-id="${id}" title="${esc(E.ITEM(id).nome)}"><img src="${E.ITEM(id).img}"></div>`).join('')}</div>
        <div class="row" style="margin-top:14px"><button class="pri" data-a="nao">Não descartar — comprar ${pd.n}</button></div>`);
      $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('resolverWally', c.dataset.id));
      $('#modalCard').querySelector('[data-a]').onclick = () => agir('resolverWally', null); return;
    }
    if (pd.tipo === 'aquaCompra') {
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">Faltam <b>${pd.resta}</b>. Clique num Item descartado pelos oponentes ou compre da pilha.</p>
        <div class="pick">${pd.pool.length ? pd.pool.map(id => `<div class="pc" data-id="${id}" title="${esc(E.ITEM(id).nome)}"><img src="${E.ITEM(id).img}"></div>`).join('') : '<span class="mut">Nenhum Item descartado disponível.</span>'}</div>
        <div class="row" style="margin-top:14px"><button class="pri" data-a="pilha">🂠 Comprar da pilha</button><button data-a="parar">Parar aqui</button></div>`);
      $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('comprarAqua', c.dataset.id));
      $('#modalCard').querySelectorAll('[data-a]').forEach(b => b.onclick = () => agir('comprarAqua', b.dataset.a)); return;
    }
    if (pd.tipo === 'criadores') return mCriadores(pd, p);
    if (pd.tipo === 'magmaTroca') {
      const meu = p.treinador && E.idx().tr[p.treinador];
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">Seu Treinador atual: <b>${meu ? esc(meu.nome) : 'nenhum'}</b>. Clique num dos descartados para trocar.</p>
        <div class="pick">${pd.opcoes.map(id => `<div class="pc" data-id="${id}" title="${esc(E.idx().tr[id].nome)}"><img src="${E.idx().tr[id].img}"></div>`).join('')}</div>
        <div class="row" style="margin-top:14px"><button data-a="manter">Manter o meu</button></div>`);
      $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('resolverMagma', c.dataset.id));
      $('#modalCard').querySelector('[data-a]').onclick = () => agir('resolverMagma', null); return;
    }
    if (pd.tipo === 'briney') return mBriney(pd, p);
    if (pd.tipo === 'espaco') {
      if (p.ia) { abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(p.nome)} está escolhendo…</p>`); return; }
      if (!boardMode) { fecharModal(); $('#modalCard').dataset.pend = 'espaco'; boardMode = { tipo: 'espaco', pend: true, filtro: pd.opcoes, msg: pd.titulo, cb: k => agir('escolherEspaco', k) }; renderBoard(); }
      return;
    }
    if (pd.tipo === 'slot') return mSlot(pd, p);
    if (pd.tipo === 'lura') {
      const cartaHtml = k => { const c = st.slots[k], pk = E.P(c.carta); return `<div class="pc" data-k="${k}" title="Hexágono ${nomeHex(k)}"><img src="${c.aberta ? pk.img : D.versos[E.grafo(st).slots[k].cor]}"><span class="f">${nomeHex(k)}${c.fraco ? ' · enfraq.' : ''}</span></div>`; };
      const porCor = {}; pd.opcoes.forEach(k => { const cor = E.P(st.slots[k].carta).cor; (porCor[cor] = porCor[cor] || []).push(k); });
      abrirModal(`<h2>${esc(pd.titulo)}</h2>${pd.primeiro ? `<div class="row" style="margin:6px 0 12px"><span class="mut">Primeiro:</span><div style="width:90px">${cartaHtml(pd.primeiro).replace('class="pc"', 'class="pc sel"')}</div></div>` : '<p class="mut">Os dois precisam ser da mesma cor, e pelo menos um deve estar revelado.</p>'}
        ${Object.entries(porCor).map(([cor, ks]) => `<h3 style="margin-top:10px">${esc(cor)}</h3><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(90px,1fr))">${ks.map(cartaHtml).join('')}</div>`).join('')}`);
      $('#modalCard').querySelectorAll('.pick .pc').forEach(c => c.onclick = () => agir('escolherLura', c.dataset.k)); return;
    }
    if (pd.tipo === 'tipoCor') return mTipoCor(pd);
    if (pd.tipo === 'pegarDeLista') return mEscolher(pd, pd.cartas.map(id => ({ id, img: E.P(id).img })), id => agir('pegarDeLista', id), 'Clique para pegar');
    if (pd.tipo === 'pegarItens') return mEscolher(pd, pd.itens.map(id => ({ id, img: E.ITEM(id).img })), id => agir('pegarItem', id), 'Clique no Item para ficar com ele');
    if (pd.tipo === 'escolherLider') { abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">Líderes fora do tabuleiro que dão uma insígnia que você ainda pode ganhar.</p><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${pd.opcoes.map(id => { const L = E.idx().ld[id], pl = window.AI && window.AI.planoLider(st, p, L); return `<div class="pc" data-id="${id}"><img src="${L.img}"><span class="f">${pl ? Math.round(pl.p * 100) + '%' : '—'}</span></div>`; }).join('')}</div>`); $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('escolherLiderFora', c.dataset.id)); return; }
    if (pd.tipo === 'pagarItens') return mPagar(pd, p);
    if (pd.tipo === 'negociador') return mNegociador(pd, p);
    if (pd.tipo === 'desempate') { abrirModal(`<h2>${esc(pd.titulo)}</h2><div style="display:grid;gap:8px">${pd.opcoes.map(i => linhaJogador(E.J(st, i), insignias(E.J(st, i), true))).join('')}</div>`); $('#modalCard').querySelectorAll('.pj').forEach(c => c.onclick = () => agir('escolherDesempate', +c.dataset.p)); return; }
    if (pd.tipo === 'descartarDe') return mEscolher(pd, pd.itens.map(id => ({ id, img: E.ITEM(id).img })), id => agir('descartarDe', id), 'Clique no Item que será descartado');
    if (pd.tipo === 'boneca') return mBoneca(pd);
    if (pd.tipo === 'troca') return mTroca(pd, p);
    if (pd.tipo === 'dividir') return mEscolher(pd, pd.itens.map(id => ({ id, img: E.ITEM(id).img })), id => agir('resolverDividir', id), 'Clique no Item que você quer manter');
    if (pd.tipo === 'opcao') { abrirModal(`<h2>${esc(pd.titulo)}</h2><div class="mfoot" style="justify-content:flex-start">${pd.opcoes.map((o, k) => `<button class="pri" data-o="${k}">${esc(o.nome)}</button>`).join('')}</div>`); $('#modalCard').querySelectorAll('[data-o]').forEach(b => b.onclick = () => agir('escolherOpcao', +b.dataset.o)); return; }
    if (pd.tipo === 'duelo') return mDuelo(pd);
    if (pd.tipo === 'liga') return abrirModal(`<h2>🏆 A Liga Pokémon começa!</h2><p>${esc(p.nome)} parou em "Começar a Liga" depois de dar a volta no Planalto.</p>
      <div class="mfoot"><button class="pri" id="ok">Começar a Liga</button></div>`), $('#ok').onclick = () => agir('fecharPend');
    if (pd.tipo === 'ligaOponente') return mLigaOponente(pd);
    if (pd.tipo === 'praca') return mPraca(pd);
    if (pd.tipo === 'cynthia') return mCynthia(pd);
    if (pd.tipo === 'repel') return mRepel(pd);
    if (pd.tipo === 'pracaPremio') return mPracaPremio(pd, p);
    if (pd.tipo === 'ligaBatalha') return mLiga(pd);
    if (pd.tipo === 'campeao') return mCampeao(pd);
  }
  function mCynthia(pd) {
    const q = E.J(st, pd.respondente), c = E.P(pd.carta), cap = E.J(st, pd.capturador);
    const chance = Math.round(window.AI.pCaptura(st, q, pd.carta, null, pd.slot) * 100);
    abrirModal(`<div class="mgrid"><img src="${c.img}"><div><h2>${esc(pd.titulo)}</h2>
      <p>${esc(cap.nome)} falhou na captura de <b>${esc(c.nome)}</b> no seu hexágono. Com a <b>Cynthia</b>, ${esc(q.nome)} pode tentar essa captura antes de o Pokémon ficar enfraquecido.</p>
      ${q.ia ? `<p class="mut">🤖 ${esc(q.nome)} está decidindo…</p>` : `<p class="mut">Chance sem Poké-Bola: ~${chance}%. Você poderá usar suas Bolas normalmente.</p><div class="mfoot" style="justify-content:flex-start"><button class="pri" id="cyS">Tentar a captura</button><button id="cyN">Não</button></div>`}</div></div>`);
    if (q.ia) { const k = 'cy' + st.log.length + q.id; if (!E.J(st).ia && !ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd) agirIA('responderCynthia', window.AI.decidirCynthia(st)); }, 900); return; }
    $('#cyS').onclick = () => agir('responderCynthia', true); $('#cyN').onclick = () => agir('responderCynthia', false);
  }
  // ---------- Festival de Praça ----------
  let animPr = { feito: null, timer: null };
  function arenaPraca(pd, r, animando) {
    const lado = l => {
      const q = E.J(st, pd[l]), dets = r.det[l], dado = l === 'a' ? r.da : r.db, tot = l === 'a' ? r.fa : r.fb, soma = l === 'a' ? r.sa : r.sb;
      const venceu = r.venc === pd[l];
      const linha = (rot, v) => v ? `<div class="ln"><span>${rot}</span><b>${v > 0 ? '+' : ''}${v}</b></div>` : '';
      return `<div class="lado ${animando ? '' : venceu ? 'venc' : 'perd'}">
        <div class="quem"><span class="dot" style="background:${COR_HEX[q.cor]}"></span>${esc(q.nome)}${animando ? '' : venceu ? ' <span class="selo ok">VENCEU</span>' : ' <span class="selo no">PERDEU</span>'}</div>
        <div class="row" style="justify-content:center;gap:8px">${dets.map(d => `<img class="carta" src="${E.P(d.pokemon).img}" style="width:${dets.length > 1 ? 96 : 120}px">`).join('')}</div>
        ${dets.map(d => `<div class="calc"><div class="ln"><span>Força de ${esc(E.P(d.pokemon).nome)}</span><b>${d.base}</b></div>${linha('Evolução / +1 (só Rosas e Verdes)', d.evol)}${linha('Treinador', d.trein)}${linha('Vantagem de tipo', d.vant)}
          ${d.itemId ? `<div class="ln"><span><img class="miniItem" src="${E.idx().it[d.itemId].img}"> ${esc(E.idx().it[d.itemId].nome)}</span><b>+${d.item}</b></div>` : ''}${dets.length > 1 ? `<div class="ln sub" style="font-size:13px"><span>Subtotal</span><b>${d.forca}</b></div>` : ''}</div>`).join('')}
        <div class="calc"><div class="ln sub"><span>Força da dupla</span><b>${soma}</b></div></div>
        <div class="rolling ${animando ? '' : 'final'}"><div class="die3d ${animando ? '' : 'parou ' + (venceu ? 'ok' : 'no')}"><span>${animando ? 1 + Math.floor(Math.random() * 6) : dado}</span></div>
          <div class="tot">${animando ? '<span class="mut">rolando…</span>' : `<span class="mut">${soma} + ${dado} =</span> <b>${tot}</b>`}</div></div></div>`;
    };
    return `<div class="arena">${lado('a')}<div class="vs">VS</div>${lado('b')}</div>`;
  }
  function mPraca(pd) {
    const r = pd.resultado, humanoVez = !E.J(st).ia;
    const chave = r ? 'P' + r.seq : null, animando = !!(r && animPr.feito !== chave);
    if (animando && !animPr.timer) {
      const giro = setInterval(() => document.querySelectorAll('.arena .die3d span').forEach(x => x.textContent = 1 + Math.floor(Math.random() * 6)), 70);
      animPr.timer = setTimeout(() => { clearInterval(giro); animPr.timer = null; animPr.feito = chave; render(); }, 800);
    }
    const A = E.J(st, pd.a), B = E.J(st, pd.b);
    let corpo = '';
    if (r) {
      corpo = `${arenaPraca(pd, r, animando)}${animando ? '' : `<div class="result surge ok"><b class="big">🏆 ${esc(E.J(st, r.venc).nome)} vence o Festival de Praça!</b>${r.empates ? `<div class="mut">Houve ${r.empates} empate(s): os dados foram rolados de novo.</div>` : ''}</div>
        <div class="mfoot"><button class="pri" id="prOk">Escolher o prêmio ▸</button></div>`}`;
      if (!animando && humanoVez && A.ia && B.ia) { const k = 'prf' + r.seq; if (!ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd) agir('fecharPraca'); }, 1800); }
    } else {
      const S = sel.praca && sel.praca.k === pd.titulo ? sel.praca : (sel.praca = { k: pd.titulo, aberto: null, ids: { a: [], b: [] }, it: { a: {}, b: {} } });
      // IAs escolhem em segredo (na vez de um humano)
      ['a', 'b'].forEach(l => { const k = 'pr' + pd.titulo + l; if (humanoVez && E.J(st, pd[l]).ia && !pd.dupla[l] && !ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd && !pd.dupla[l]) { const d = window.AI.duplaPraca(st, l); agirIA('escolherDuplaPraca', l, d.ids, d.itens); } }, 700); });
      const humanosP = ['a', 'b'].filter(l => !E.J(st, pd[l]).ia && souEu(pd[l])), pend = humanosP.filter(l => !pd.dupla[l]);
      const painel = l => {
        const q = E.J(st, pd[l]), ap = E.pracaAptosDe(q), n = Math.min(2, ap.length), its = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus), I = S.it[l];
        return `<div class="lgEsc"><h3>${esc(q.nome)}, escolha ${n === 2 ? 'sua dupla' : 'seu Pokémon'} <span class="mut">(em segredo)</span></h3>
          <div class="ligaPick">${timeAgrupado(q, 78, { ids: ap, bonus: id => E.bonusEvolucao(q, id, ['inicial', 'rosa', 'verde']), carta: id => `<div class="pc ${S.ids[l].includes(id) ? 'sel' : ''}" data-pp="${id}" data-pl="${l}" title="${esc(E.P(id).nome)}"><img src="${E.P(id).img}"><span class="f">${E.pracaForca(st, q.id, id, null, []).forca}</span></div>` })}</div>
          ${S.ids[l].map(id => `<div class="row" style="margin-top:6px"><span style="min-width:120px">${esc(E.P(id).nome)}:</span><select data-pi="${id}" data-pl="${l}" style="flex:1"><option value="">— sem Item —</option>${its.filter(i => i === I[id] || !Object.values(I).includes(i)).map(i => `<option value="${i}" ${I[id] === i ? 'selected' : ''}>${esc(E.ITEM(i).nome)} (+${E.bonusItemBatalha(i, id)})</option>`).join('')}</select></div>`).join('')}
          <div class="mfoot"><button class="pri" data-pc="${l}" ${S.ids[l].length === n ? '' : 'disabled'}>Confirmar</button></div></div>`;
      };
      const linhas = ['a', 'b'].map(l => { const q = E.J(st, pd[l]); return `<div class="mut">${esc(q.nome)}: ${pd.dupla[l] ? '✔ escolha feita' : q.ia ? '🤖 escolhendo…' : 'escolhendo'}</div>`; }).join('');
      let area = '';
      if (pend.length) {
        const l = S.aberto && pend.includes(S.aberto) ? S.aberto : (humanosP.length === 2 ? null : pend[0]);
        area = l ? painel(l) : `<div class="lgGate">${pend.map(x => `<button class="pri" data-pg="${x}">🙈 ${esc(E.J(st, pd[x]).nome)}: mostrar minhas opções</button>`).join(' ')}<p class="mut">Cada um escolhe sem o outro olhar. As duplas só aparecem quando as duas forem confirmadas.</p></div>`;
      }
      corpo = `<div style="margin:10px 0">${linhas}</div>${area}`;
    }
    const pz = E.J(st);
    const cel = r && !animando && !pz.ia && [pd.a, pd.b].includes(pz.id) && E.celebiDe(pz) ? `<div class="row celebiRow"><span class="mut">🌸 ${esc(pz.nome)}, usar Pedido a Celebi?</span><button class="celebi" data-pcd="a">Refazer o dado de ${esc(A.nome)} (${r.da})</button><button class="celebi" data-pcd="b">Refazer o dado de ${esc(B.nome)} (${r.db})</button></div>` : '';
    abrirModal(`<h2>🎪 ${esc(pd.titulo)}</h2><p class="mut">Dupla contra dupla, só Pokémons Rosas, Verdes e Iniciais (Azuis ou mais fortes não contam nem para o bônus de evolução). Cada dupla soma as forças e rola um dado. As duplas são escolhidas ao mesmo tempo, em segredo.</p>${corpo.replace('<div class="mfoot"><button class="pri" id="prOk">', cel + '<div class="mfoot"><button class="pri" id="prOk">')}`);
    const M = $('#modalCard');
    const ok = $('#prOk'); if (ok) ok.onclick = () => agir('fecharPraca');
    M.querySelectorAll('[data-pcd]').forEach(b => b.onclick = () => agir('celebiPraca', b.dataset.pcd));
    M.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { sel.praca.aberto = b.dataset.pg; render(); });
    M.querySelectorAll('[data-pp]').forEach(c => c.onclick = () => { const S = sel.praca, l = c.dataset.pl, id = c.dataset.pp, n = Math.min(2, E.pracaAptosDe(E.J(st, pd[l])).length); if (S.ids[l].includes(id)) { S.ids[l] = S.ids[l].filter(x => x !== id); delete S.it[l][id]; } else { if (S.ids[l].length >= n) { const fora = S.ids[l].shift(); delete S.it[l][fora]; } S.ids[l].push(id); } render(); });
    M.querySelectorAll('[data-pi]').forEach(x => x.onchange = () => { const I = sel.praca.it[x.dataset.pl]; if (x.value) I[x.dataset.pi] = x.value; else delete I[x.dataset.pi]; render(); });
    M.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { const S = sel.praca, l = b.dataset.pc, ids = S.ids[l], it = S.it[l]; S.aberto = null; S.ids[l] = []; S.it[l] = {}; agir('escolherDuplaPraca', l, ids, it); });
  }
  function mPracaPremio(pd, p) {
    if (p.ia) { abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(p.nome)} está escolhendo…</p>`); return; }
    abrirModal(`<h2>🎪 ${esc(pd.titulo)}</h2><div style="display:grid;gap:8px;margin-top:12px">${Object.entries(E.PREMIOS_PRACA).map(([k, v]) => `<button class="pri" data-pz="${k}" style="text-align:left">${esc(v[0])}${k === 'azul' && !E.obedece(p, 'azul') ? ' <span class="mut">(ainda não te obedece)</span>' : ''}</button>`).join('')}</div>`);
    $('#modalCard').querySelectorAll('[data-pz]').forEach(b => b.onclick = () => agir('resolverPracaPremio', b.dataset.pz));
  }
  // ---------- Liga Pokémon ----------
  const forcaTrio = q => q.pokemon.filter(id => E.obedece(q, E.P(id).cor)).map(id => E.forcaBase(q, id) + E.bonusTreinador(q, id)).sort((a, b) => b - a).slice(0, 3);
  let ligaTimers = {};
  function mLigaOponente(pd) {
    const q = E.J(st, pd.escolhe);
    if (q.ia) {
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(q.nome)} está escolhendo o oponente…</p>`);
      const k = 'op' + st.log.length; if (!E.J(st).ia && !ligaTimers[k]) { ligaTimers[k] = setTimeout(() => { if (st.pend === pd) agirIA('resolverLigaOponente', window.AI.oponenteLiga(st)); }, 900); }
      return;
    }
    abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">${pd.opcoes.length === 3 ? 'Os outros dois se enfrentam na outra batalha.' : ''} Ao lado, a força dos 3 Pokémons mais fortes de cada um (sem vantagens de tipo).</p>
      <div style="display:grid;gap:8px;margin-top:12px">${pd.opcoes.map(j => linhaJogador(E.J(st, j), `<span class="tag">trio ${forcaTrio(E.J(st, j)).join(' · ') || '—'}</span>`)).join('')}</div>`);
    $('#modalCard').querySelectorAll('.pj').forEach(c => c.onclick = () => agir('resolverLigaOponente', +c.dataset.p));
  }
  function placarLiga(pd, l) {
    const q = E.J(st, pd[l]), at = pd.ativo[l] || (pd.forcado && pd.forcado[l]), mortos = pd.mortos[l];
    const resta = Math.max(0, (pd.extra ? mortos.length + 1 : 3) - mortos.length - (at ? 1 : 0));
    return `<div class="lgSide"><div class="quem"><span class="dot" style="background:${COR_HEX[q.cor]}"></span><b>${esc(q.nome)}</b>${q.ia ? ' 🤖' : ''}</div>
      <div class="lgSlots">${mortos.map(id => `<div class="lgPk morto" title="${esc(E.P(id).nome)} (derrotado)"><img src="${E.P(id).img}"><span>✖</span></div>`).join('')}${at ? `<div class="lgPk ativo" title="${esc(E.P(at).nome)} (em campo)"><img src="${E.P(at).img}"></div>` : ''}${Array.from({ length: resta }, () => '<div class="lgPk oculto">?</div>').join('')}</div></div>`;
  }
  function histLiga(duelos) {
    if (!duelos.length) return '';
    const ic = id => id ? `<img class="miniItem" src="${E.idx().it[id].img}" title="${esc(E.idx().it[id].nome)}">` : '';
    return `<div class="lgHist">${duelos.map((d, k) => `<div class="lgRow"><span class="mut">Duelo ${k + 1}</span>
      <span class="lgP ${d.venc === 'a' ? 'ok' : 'no'}">${ic(d.ia)}<img src="${E.P(d.pa).img}" title="${esc(E.P(d.pa).nome)}"> <b>${d.fa}</b> ${d.venc === 'a' ? '✓' : '✗'}</span>
      <span class="lgP ${d.venc === 'b' ? 'ok' : 'no'}">${d.venc === 'b' ? '✓' : '✗'} <b>${d.fb}</b> <img src="${E.P(d.pb).img}" title="${esc(E.P(d.pb).nome)}">${ic(d.ib)}</span></div>`).join('')}</div>`;
  }
  function mLiga(pd) {
    const r = pd.resultado, nD = pd.duelos.length, humanoVez = !E.J(st).ia;
    const chave = r ? 'L' + r.seq + ':' + nD : null, animando = !!(r && animDu.feito !== chave);
    if (animando && !animDu.timer) {
      const giro = setInterval(() => document.querySelectorAll('.arena .die3d span').forEach(x => x.textContent = 1 + Math.floor(Math.random() * 6)), 70);
      animDu.timer = setTimeout(() => { clearInterval(giro); animDu.timer = null; animDu.feito = chave; render(); }, 800);
    }
    const humanosTodos = ['a', 'b'].filter(l => !E.J(st, pd[l]).ia), humanos = humanosTodos.filter(l => souEu(pd[l]));
    // IA escolhe na vez de um humano; entre duas IAs o resultado avança sozinho
    if (humanoVez && !r && !pd.vencLado) ['a', 'b'].forEach(l => { const k = pd.titulo + nD + l; if (E.J(st, pd[l]).ia && !pd.esc[l] && !ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd && !pd.esc[l] && !pd.resultado) { const e = window.AI.escolhaLiga(st, l); agirIA('ligaEscolher', l, e.pokemon, e.item); } }, 600); });
    const reIA = r && !animando && humanoVez ? window.AI.reacaoLiga(st) : null;
    if (reIA) { const k = 're' + r.seq + nD + JSON.stringify(reIA); if (!ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd && pd.resultado === r) { if (reIA.tipo === 'remedio') agirIA('ligaRemedio', reIA.lado); else agirIA('ligaCelebi', reIA.quem, reIA.lado); } }, 1200); }
    else if (humanoVez && !humanosTodos.length && (r || pd.vencLado) && !animando) { const k = 'seg' + pd.titulo + nD + (pd.vencLado || '') + (r ? r.seq : ''); if (!ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd) agir('ligaSeguir'); }, 1800); }
    const S = sel.liga && sel.liga.k === pd.titulo + nD ? sel.liga : (sel.liga = { k: pd.titulo + nD, aberto: null, pk: {}, it: {} });
    // humano com Pokémon já em campo e sem Itens de batalha: nada a decidir
    if (!r && !pd.vencLado) humanos.forEach(l => { const q = E.J(st, pd[l]); const fixo = (pd.forcado && pd.forcado[l]) || pd.ativo[l]; if (!pd.esc[l] && fixo && !q.itens.some(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus)) { const k = 'auto' + pd.titulo + nD + l + (pd.forcado ? 'f' + st.log.length : ''); if (!ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd && !pd.esc[l]) agir('ligaEscolher', l, fixo, null); }, 50); } });
    let corpo = '';
    if (r) {
      const msg = animando ? '' : r.venc == null ? 'Empate — os dois Pokémons desmaiam.' : `${esc(E.J(st, r.venc).nome)} vence o duelo${pd.vencLado ? ' e a batalha!' : ' — o Pokémon vencedor continua em campo.'}`;
      const dU = pd.duelos[nD - 1], reac = animando ? '' : humanos.map(l => {
        const q = E.J(st, pd[l]), o = l === 'a' ? 'b' : 'a', bts = [];
        if (E.celebiDe(q)) bts.push(`<button class="sm celebi" data-lcq="${l}" data-lcl="${l}">🌸 Refazer meu dado (${l === 'a' ? r.da : r.db})</button><button class="sm celebi" data-lcq="${l}" data-lcl="${o}">🌸 Refazer o dado de ${esc(E.J(st, pd[o]).nome)} (${o === 'a' ? r.da : r.db})</button>`);
        if (dU && dU.venc !== l && q.itens.some(i => i.startsWith('potion#'))) bts.push(`<button class="sm" data-lrm="${l}">💊 Remédio: reviver ${esc(E.P(l === 'a' ? dU.pa : dU.pb).nome)} e refazer o duelo</button>`);
        return bts.length ? `<div class="row celebiRow"><span class="mut">${esc(q.nome)}:</span>${bts.join('')}</div>` : '';
      }).join('');
      corpo = `${arenaDuelo(pd, r, animando)}${reac}${msg ? `<div class="result surge ${pd.vencLado ? 'ok' : ''}"><b class="big">${pd.vencLado ? '🏆 ' : ''}${msg}</b>${pd.extra && !pd.vencLado ? '<div class="mut">Duelo extra: os Pokémons dos dois lados caíram juntos.</div>' : ''}</div>` : ''}
        <div class="mfoot">${animando ? '' : `<button class="pri" id="lgSeg">${pd.vencLado ? 'Ver resultado da batalha ▸' : 'Próximo duelo ▸'}</button>`}</div>`;
    } else if (pd.vencLado) {
      const w = E.J(st, pd[pd.vencLado]);
      corpo = `<div class="result surge ok"><b class="big">🏆 ${esc(w.nome)} vence a batalha${pd.wo ? ' por W.O.' : ''}!</b><div class="mut">Quem vence uma batalha da Liga compra 3 Itens.</div></div>
        <div class="mfoot"><button class="pri" id="lgSeg">Continuar</button></div>`;
    } else {
      const outro = l => l === 'a' ? 'b' : 'a';
      const painel = l => {
        const q = E.J(st, pd[l]), at = (pd.forcado && pd.forcado[l]) || pd.ativo[l], opAt = (pd.forcado && pd.forcado[outro(l)]) || pd.ativo[outro(l)], opTipos = opAt ? E.P(opAt).tipos : [];
        const its = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus);
        const pk = at || S.pk[l];
        return `<div class="lgEsc"><h3>${esc(q.nome)}, sua escolha${opAt ? ` <span class="mut">(contra ${esc(E.P(opAt).nome)})</span>` : ''}</h3>
          ${at ? `<p>Em campo: <b>${esc(E.P(at).nome)}</b> — ${pd.forcado ? 'o duelo será refeito (Remédio).' : 'continua lutando.'}</p>` : `<div class="ligaPick">${timeAgrupado(q, 78, { ids: E.ligaAptos(st, pd, l), carta: id => `<div class="pc ${S.pk[l] === id ? 'sel' : ''}" data-lp="${l}" data-id="${id}" title="${esc(E.P(id).nome)}"><img src="${E.P(id).img}"><span class="f">${E.forcaEmBatalha(st, q.id, id, null, opTipos)}</span></div>` })}</div>`}
          <select data-li="${l}" style="margin-top:8px;width:100%"><option value="">— sem Item de batalha —</option>${its.map(i => `<option value="${i}" ${S.it[l] === i ? 'selected' : ''}>${esc(E.ITEM(i).nome)} (+${E.ITEM(i).bonus}${pk && E.bonusItemBatalha(i, pk) !== E.ITEM(i).bonus ? ', vale ' + E.bonusItemBatalha(i, pk) + ' aqui' : ''})</option>`).join('')}</select>
          <div class="mfoot"><button class="pri" data-lc="${l}" ${pk ? '' : 'disabled'}>Confirmar escolha</button></div></div>`;
      };
      const linhas = ['a', 'b'].map(l => { const q = E.J(st, pd[l]); return `<div class="mut">${esc(q.nome)}: ${pd.esc[l] ? '✔ escolha feita' : q.ia ? '🤖 escolhendo…' : pd.forcado ? 'duelo refeito com ' + esc(E.P(pd.forcado[l]).nome) + ' — falta confirmar o Item' : pd.ativo[l] ? 'em campo com ' + esc(E.P(pd.ativo[l]).nome) + ' — falta confirmar o Item' : 'escolhendo o Pokémon'}</div>`; }).join('');
      const pend = humanos.filter(l => !pd.esc[l]);
      const doisHumanos = humanos.length === 2;
      let area = '';
      if (pend.length) {
        const l = S.aberto && pend.includes(S.aberto) ? S.aberto : (doisHumanos ? null : pend[0]);
        if (l) area = painel(l);
        else area = `<div class="lgGate">${pend.map(x => `<button class="pri" data-lg="${x}">🙈 ${esc(E.J(st, pd[x]).nome)}: mostrar minhas opções</button>`).join(' ')}<p class="mut">Cada um escolhe sem o outro olhar. As escolhas só aparecem quando os dois confirmarem.</p></div>`;
      }
      corpo = `<div style="margin:10px 0">${linhas}</div>${area}`;
    }
    abrirModal(`<h2>🏆 ${esc(pd.titulo)}</h2><p class="mut">3 contra 3, um de cada vez. O vencedor do duelo continua em campo; no empate, os dois desmaiam. Cada lado pode usar 1 Item de batalha por duelo.</p>
      <div class="lgPlacar">${placarLiga(pd, 'a')}<div class="vs">VS</div>${placarLiga(pd, 'b')}</div>${histLiga(r && animando ? pd.duelos.slice(0, -1) : pd.duelos)}${corpo}`);
    const M = $('#modalCard');
    const sg = $('#lgSeg'); if (sg) sg.onclick = () => agir('ligaSeguir');
    M.querySelectorAll('[data-lcq]').forEach(b => b.onclick = () => agir('ligaCelebi', b.dataset.lcq, b.dataset.lcl));
    M.querySelectorAll('[data-lrm]').forEach(b => b.onclick = () => agir('ligaRemedio', b.dataset.lrm));
    M.querySelectorAll('[data-lg]').forEach(b => b.onclick = () => { S.aberto = b.dataset.lg; render(); });
    M.querySelectorAll('[data-lp]').forEach(c => c.onclick = () => { S.pk[c.dataset.lp] = c.dataset.id; render(); });
    M.querySelectorAll('[data-li]').forEach(x => x.onchange = () => { S.it[x.dataset.li] = x.value || null; render(); });
    M.querySelectorAll('[data-lc]').forEach(b => b.onclick = () => { const l = b.dataset.lc, pk = (pd.forcado && pd.forcado[l]) || pd.ativo[l] || S.pk[l], it = S.it[l] || null; S.aberto = null; delete S.pk[l]; delete S.it[l]; agir('ligaEscolher', l, pk, it); });
  }
  function resumoLiga() {
    const L = st.liga; if (!L) return '';
    const n = id => esc(E.J(st, id).nome);
    switch (L.etapa) {
      case 'duas': return `Melhor de 3 — ${L.ativos.map(id => n(id) + ' ' + (L.vit[id] || 0)).join(' × ')}. Quem parar em "Começar a Liga" inicia a próxima batalha.`;
      case 'tres': return `Vence quem derrotar os dois oponentes — ${L.ativos.map(id => n(id) + ': ' + ((L.venceu[id] || []).length ? 'venceu ' + L.venceu[id].map(n).join(', ') : 'sem vitórias')).join(' · ')}.`;
      case 'r1': return '1ª rodada em andamento.';
      case 'semisEspera': return `Semifinalistas: ${L.ativos.map(n).join(', ')}. Quem parar em "Começar a Liga" escolhe o oponente.`;
      case 'semis': return 'Semifinais em andamento.';
      case 'final': return `Final: ${L.ativos.map(n).join(' × ')} — turnos antes da final: ${L.ativos.map(id => n(id) + ' ' + Math.max(0, L.finalTurnos[id])).join(', ')}.`;
      case 'fim': return st.vencedor != null ? `👑 ${n(st.vencedor)} é o Mestre Pokémon.` : '';
    }
    return '';
  }
  function histBatalhas() {
    const L = st.liga; if (!L || !L.hist.length) return '<p class="mut">Nenhuma batalha ainda.</p>';
    return L.hist.map(h => `<details class="lgBat"><summary><b>${esc(E.FASE_LIGA[h.fase])}</b>: ${esc(E.J(st, h.a).nome)} × ${esc(E.J(st, h.b).nome)} → 🏆 ${esc(E.J(st, h.venc).nome)}${h.wo ? ' (W.O.)' : ` <span class="mut">(${h.duelos.length} duelo${h.duelos.length > 1 ? 's' : ''})</span>`}</summary>${histLiga(h.duelos)}</details>`).join('');
  }
  function modalLiga() {
    const L = st.liga;
    abrirModal(`<h2>🏆 Liga Pokémon — Mata-Mata (${L.n} jogadores)</h2><p>${resumoLiga()}</p>
      ${L.elim.length ? `<p class="mut">Eliminados: ${L.elim.map(id => esc(E.J(st, id).nome)).join(', ')}.</p>` : ''}
      <h3>Batalhas</h3>${histBatalhas()}<div class="mfoot"><button class="pri" id="ok">Fechar</button></div>`);
    $('#ok').onclick = fecharModal;
  }
  function mCampeao(pd) {
    const q = E.J(st, pd.jogador);
    abrirModal(`<div class="campeao"><div class="coroa">👑</div><h2>${esc(q.nome)} é o novo Mestre Pokémon!</h2>
      <div class="team" style="justify-content:center">${q.pokemon.map(id => `<img src="${E.P(id).img}" style="width:70px;border-radius:6px">`).join('')}</div></div>
      <h3>Caminho na Liga</h3>${histBatalhas()}<div class="mfoot"><button class="pri" id="ok">Ver o tabuleiro</button></div>`);
    $('#ok').onclick = () => agir('fecharPend');
  }
  function mCriadores(pd, p) {
    if (p.ia) { abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(p.nome)} está escolhendo…</p>`); return; }
    const c = sel.cri && sel.cri.k === st.log.length ? sel.cri : (sel.cri = { k: st.log.length, op: null, desc: [], cor: null, pegar: null });
    const ops = E.opcoesCriadores(st, p), N = c.op === 1 ? 2 : 3;
    const NOMES = { 1: 'Descartar 2 da mesma linha evolutiva → pegar qualquer Pokémon Azul ou mais fraco fora do jogo', 2: 'Descartar 3 da mesma linha evolutiva → pegar qualquer Pokémon fora do jogo', 3: 'Comprar 2 Cartas Item' };
    let corpo;
    if (!c.op) {
      corpo = `<div style="display:grid;gap:8px">${[1, 2, 3].map(k => `<button class="${ops[k] ? 'pri' : ''}" data-op="${k}" ${ops[k] ? '' : 'disabled'} style="text-align:left">${k}) ${NOMES[k]}${ops[k] ? '' : ' <span class="mut">— você não tem ' + (k === 1 ? '2' : '3') + ' Pokémons da mesma linha</span>'}</button>`).join('')}</div>`;
    } else if (c.desc.length < N) {
      const linhas = E.linhasCriadores(p, N);
      corpo = `<p><b>${c.op}) ${NOMES[c.op]}</b></p><p class="mut">Clique em ${N} Pokémons da mesma linha evolutiva para descartar (${c.desc.length}/${N}).</p>
        ${linhas.map(l => `<div class="pick criaLinha" style="margin-bottom:10px">${l.map(id => `<div class="pc ${c.desc.includes(id) ? 'sel' : ''}" data-d="${id}" title="${esc(E.P(id).nome)}"><img src="${E.P(id).img}"></div>`).join('')}</div>`).join('')}
        <div class="row"><button data-a="voltar">← Voltar</button></div>`;
    } else {
      const cores = c.op === 1 ? ['rosa', 'verde', 'azul'] : ['inicial', 'rosa', 'verde', 'azul', 'vermelho', 'amarelo'];
      const todos = E.foraDeJogoCriadores(st, c.op), cor = c.cor && cores.includes(c.cor) ? c.cor : cores.find(x => todos.some(id => E.P(id).cor === x)) || cores[0];
      const lista = todos.filter(id => E.P(id).cor === cor).sort((a, b) => E.P(b).forca - E.P(a).forca || E.P(a).nome.localeCompare(E.P(b).nome));
      corpo = `<p class="mut">Descartando: <b>${c.desc.map(id => esc(E.P(id).nome)).join(', ')}</b>. Agora escolha o Pokémon que vai pegar.</p>
        <div class="row" style="margin-bottom:8px">${cores.map(x => `<button class="sm ${x === cor ? 'pri' : ''}" data-cor="${x}">${x} (${todos.filter(id => E.P(id).cor === x).length})</button>`).join('')}</div>
        <div class="criaGrid">${lista.map(id => `<div class="pc ${c.pegar === id ? 'sel' : ''}" data-g="${id}" title="${esc(E.P(id).nome)} · força ${E.P(id).forca}"><img src="${E.P(id).img}"></div>`).join('') || '<span class="mut">Nenhum desta cor fora do jogo.</span>'}</div>
        <div class="row" style="margin-top:12px"><button data-a="voltar">← Voltar</button><button class="pri" data-a="ok" ${c.pegar ? '' : 'disabled'}>Confirmar${c.pegar ? ': pegar ' + esc(E.P(c.pegar).nome) : ''}</button></div>`;
      c.cor = cor;
    }
    abrirModal(`<h2>${esc(pd.titulo)}</h2>${corpo}`);
    const M = $('#modalCard');
    M.querySelectorAll('[data-op]').forEach(b => b.onclick = () => { const k = +b.dataset.op; if (k === 3) { sel.cri = null; agir('resolverCriadores', 3); } else { c.op = k; c.desc = []; c.pegar = null; render(); } });
    M.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const id = b.dataset.d; if (c.desc.includes(id)) c.desc = c.desc.filter(x => x !== id); else { if (c.desc.length && E.P(c.desc[0]).familia !== E.P(id).familia) c.desc = []; c.desc.push(id); } render(); });
    M.querySelectorAll('[data-cor]').forEach(b => b.onclick = () => { c.cor = b.dataset.cor; render(); });
    M.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { c.pegar = b.dataset.g; render(); });
    M.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      if (b.dataset.a === 'voltar') { if (c.desc.length >= N) { c.desc = []; c.pegar = null; } else c.op = null; return render(); }
      const { op, desc, pegar } = c; sel.cri = null; agir('resolverCriadores', op, desc, pegar);
    });
  }
  function mEscolher(pd, cartas, cb, sub) {
    abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">${esc(sub)}</p><div class="pick">${cartas.map(c => `<div class="pc" data-id="${c.id}"><img src="${c.img}"></div>`).join('')}</div>`);
    $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => cb(c.dataset.id));
  }
  // animação: o resultado já foi sorteado pelo motor; a tela só "segura" a revelação por ~0,9 s
  let animCap = { feito: null, timer: null };
  function chaveCap(pd) { return pd.carta + '|' + st.log.length; }
  function rolagemAnimada(r) {
    return `<div class="rolling">${r.dados.map(() => `<div class="die3d"><span>${1 + Math.floor(Math.random() * 6)}</span></div>`).join('')}<span class="mut">rolando…</span></div>`;
  }
  function mCaptura(pd, p) {
    const c = E.P(pd.carta), r0 = pd.resultado;
    const k = r0 ? chaveCap(pd) : null, animando = r0 && animCap.feito !== k;
    if (animando && !animCap.timer) {
      animCap.timer = setInterval(() => { document.querySelectorAll('.die3d span').forEach(s => s.textContent = 1 + Math.floor(Math.random() * 6)); }, 70);
      setTimeout(() => { clearInterval(animCap.timer); animCap.timer = null; animCap.feito = k; render(); }, 800);
    }
    const r = animando ? null : r0;
    const bolas = p.itens.filter(i => E.ITEM(i).bola);
    const escolhida = sel.bola && bolas.includes(sel.bola) ? sel.bola : null;
    const faixa = E.faixaCaptura(st, p, pd.carta, escolhida, pd.slot);
    const tr = p.treinador && E.idx().tr[p.treinador];
    abrirModal(`<div class="mgrid"><img src="${c.img}"><div>
      <h2>${esc(pd.titulo)}</h2><div class="mut">Pokémon ${esc(c.cor)} · força ${c.forca}${pd.slot && st.slots[pd.slot] && st.slots[pd.slot].fraco ? ' · <b style="color:#fbbf24">enfraquecido (±1)</b>' : ''}</div>
      <p style="margin:10px 0 2px">Dados que capturam:</p>${c.captura.length ? faces(c.captura) : '<p class="mut">Este Pokémon não pode ser capturado.</p>'}
      ${animando ? rolagemAnimada(r0) : ''}
      ${!r && !animando ? `<p style="margin:12px 0 4px">Usar Poké-Bola? <span class="mut">(anuncie antes de rolar)</span></p>
        <div class="hand">${bolas.map(i => `<div class="ic ${i === escolhida ? 'sel' : ''}" data-b="${i}" title="${esc(E.ITEM(i).nome)}"><img src="${E.ITEM(i).img}"></div>`).join('') || '<span class="mut">Você não tem Bolas.</span>'}</div>
        <p class="mut">Ajuste permitido no dado: <b>±${faixa}</b>${tr && tr.efeito === 'red' ? ' · Red: rola 2 dados' : ''}</p>` : ''}
      ${r ? `<div class="rolling final">${r.dados.map(d => `<div class="die3d parou ${r.ok ? 'ok' : 'no'}"><span>${d}</span></div>`).join('')}</div><div class="result surge ${r.ok ? 'ok' : 'no'}"><b class="big">${r.ok ? 'Capturado!' : 'Escapou…'}</b>Dado${r.dados.length > 1 ? 's' : ''}: ${r.dados.join(' e ')}${r.faixa ? ` · ajuste ±${r.faixa}` : ''}${!r.ok && pd.slot && c.cor !== 'amarelo' ? '<br>O Pokémon fica revelado e enfraquecido.' : ''}</div>` : ''}
      <div class="mfoot">${animando ? '' : !r ? `<button data-desist>Não tentar</button><button class="pri" id="rol" ${c.captura.length ? '' : 'disabled'}>🎲 Rolar captura</button>` : `${!r.ok && E.celebiDe(p) && !p.ia ? '<button class="celebi" id="celC">🌸 Pedido a Celebi: refazer</button>' : ''}<button class="pri" id="ok">Continuar</button>`}</div>
    </div></div>`);
    const cc = $('#celC'); if (cc) cc.onclick = () => agir('celebiCaptura');
    $('#modalCard').querySelectorAll('[data-b]').forEach(b => b.onclick = () => { sel.bola = sel.bola === b.dataset.b ? null : b.dataset.b; render(); });
    const rol = $('#rol'); if (rol) rol.onclick = () => { const b = escolhida; sel.bola = null; agir('rolarCaptura', b); };
    const ds = $('[data-desist]'); if (ds) ds.onclick = () => { agir('desistirCaptura'); };
    const ok = $('#ok'); if (ok) ok.onclick = () => agir('fecharPend');
  }
  // ---------- janela de reações (Exp. Share / Poké-Flauta) ----------
  let reac = { seq: null, fim: 0, tick: null, quem: null, iaFeitos: {} };
  const REAC_MS = 5000;
  function janelaReacao(pd, card) {
    const R = pd.reacao;
    if (reac.seq !== R.seq) {
      clearInterval(reac.tick); reac = { seq: R.seq, fim: Date.now() + REAC_MS, tick: null, quem: null, iaFeitos: {} };
      reac.tick = setInterval(() => {
        if (!st || !E.reacaoAberta(st) || st.pend.reacao.seq !== reac.seq) { clearInterval(reac.tick); return; }
        const rest = Math.max(0, Math.ceil((reac.fim - Date.now()) / 1000)); const el = $('#reacSeg'); if (el) el.textContent = rest;
        const pend = Object.keys(st.pend.reacao.opcoes).filter(j => st.pend.reacao.resp[j] == null);
        const humanos = pend.filter(j => !E.J(st, +j).ia);
        if (Date.now() >= reac.fim || (!humanos.length && !pend.length)) { clearInterval(reac.tick); agirIA('encerrarReacoes'); }
      }, 250);
    }
    // IAs decidem com um pequeno atraso, para não denunciar quem tem o item
    Object.keys(R.opcoes).filter(j => R.resp[j] == null && E.J(st, +j).ia && !reac.iaFeitos[j]).forEach(j => {
      reac.iaFeitos[j] = true; setTimeout(() => { if (E.reacaoAberta(st) && st.pend.reacao.seq === R.seq && st.pend.reacao.resp[j] == null) agirIA('reagir', +j, window.AI.decidirReacao(st, +j)); }, 1200 + Math.random() * 2000);
    });
    const humanos = online() ? [] : st.jogadores.filter(q => !q.ia);
    if (online() && R.opcoes[NET.eu] && R.resp[NET.eu] == null) reac.quem = NET.eu;
    let painel = '';
    if (reac.quem != null) {
      const q = E.J(st, reac.quem), op = R.opcoes[q.id], ja = R.resp[q.id] != null;
      painel = op && !ja ? `<div class="reacBox"><b>${esc(q.nome)}</b>, reagir a "${esc(card.nome)}"?<div class="row" style="margin-top:8px">${op.includes('exp') ? '<button class="pri" data-r="exp">📘 Copiar com Exp. Share</button>' : ''}${op.includes('may') ? '<button class="pri" data-r="may">♻️ Reciclar a May (copiar)</button>' : ''}${op.includes('flauta') ? '<button class="pri" data-r="flauta">🎵 Tocar Poké-Flauta (cancelar)</button>' : ''}<button data-r="nao">Não usar</button></div></div>`
        : `<div class="reacBox mut">${esc(q.nome)}: ${ja ? 'resposta já registrada.' : 'você não tem item de reação para este Evento.'} <button class="sm" data-r="voltar">ok</button></div>`;
    }
    return `<div class="reacWait"><div><span class="spin">⏳</span> <b>Aguardando reações…</b> <span class="mut"><span id="reacSeg">${Math.max(0, Math.ceil((reac.fim - Date.now()) / 1000))}</span> s</span></div>
      ${humanos.length ? `<div class="row" style="margin-top:8px"><span class="mut">Tenho uma reação:</span>${humanos.map(q => `<button class="sm" data-quem="${q.id}">${esc(q.nome)}</button>`).join('')}</div>` : ''}${painel}</div>`;
  }
  // ---------- Repel: janela após revelações no tabuleiro ----------
  let rp = { seq: null, fim: 0, tick: null, quem: null, iaFeitos: {} };
  function mRepel(pd) {
    if (rp.seq !== pd.seq) {
      clearInterval(rp.tick); rp = { seq: pd.seq, fim: Date.now() + REAC_MS, tick: null, quem: null, iaFeitos: {} };
      rp.tick = setInterval(() => {
        if (!st || !st.pend || st.pend.tipo !== 'repel' || st.pend.seq !== rp.seq) { clearInterval(rp.tick); return; }
        const el = $('#rpSeg'); if (el) el.textContent = Math.max(0, Math.ceil((rp.fim - Date.now()) / 1000));
        if (Date.now() >= rp.fim) { clearInterval(rp.tick); agirIA('encerrarRepel'); }
      }, 250);
    }
    pd.opcoes.filter(j => pd.resp[j] == null && E.J(st, j).ia && !rp.iaFeitos[j]).forEach(j => {
      rp.iaFeitos[j] = true; setTimeout(() => { if (st.pend === pd && pd.resp[j] == null) agirIA('reagirRepel', j, window.AI.decidirRepel(st, j)); }, 1000 + Math.random() * 2000);
    });
    const cartas = pd.slots.map(k => st.slots[k] && st.slots[k].carta).filter(Boolean);
    const humanos = online() ? [] : st.jogadores.filter(q => !q.ia && !q.eliminado);
    if (online() && pd.opcoes.includes(NET.eu) && pd.resp[NET.eu] == null) rp.quem = NET.eu;
    let painel = '';
    if (rp.quem != null) {
      const q = E.J(st, rp.quem), pode = pd.opcoes.includes(q.id) && pd.resp[q.id] == null;
      painel = pode ? `<div class="reacBox"><b>${esc(q.nome)}</b>, usar o Repel?<div class="row" style="margin-top:8px;flex-wrap:wrap">${pd.slots.map(k => `<button class="pri" data-rk="${k}">🚫 Trocar ${esc(E.P(st.slots[k].carta).nome)}</button>`).join('')}<button data-rk="nao">Não usar</button><button data-rk="pausa">Não usar até o meu próximo turno</button></div></div>`
        : `<div class="reacBox mut">${esc(q.nome)}: ${pd.resp[q.id] != null ? 'resposta já registrada.' : 'você não tem item de reação para esta revelação.'} <button class="sm" data-rk="voltar">ok</button></div>`;
    }
    abrirModal(`<h2>👀 ${esc(pd.titulo)}</h2>
      <div class="row" style="gap:10px;justify-content:center;margin:10px 0">${cartas.map(id => `<img src="${E.P(id).img}" style="width:${cartas.length > 2 ? 110 : 160}px;border-radius:8px;box-shadow:var(--shadow)">`).join('')}</div>
      <div class="reacWait"><div><span class="spin">⏳</span> <b>Aguardando reações…</b> <span class="mut"><span id="rpSeg">${Math.max(0, Math.ceil((rp.fim - Date.now()) / 1000))}</span> s</span></div>
      ${humanos.length ? `<div class="row" style="margin-top:8px"><span class="mut">Tenho uma reação:</span>${humanos.map(q => `<button class="sm" data-rq="${q.id}">${esc(q.nome)}</button>`).join('')}</div>` : ''}${painel}</div>`);
    const M = $('#modalCard');
    M.querySelectorAll('[data-rq]').forEach(b => b.onclick = () => { rp.quem = +b.dataset.rq; rp.fim = Math.max(rp.fim, Date.now() + 5000); render(); });
    M.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => { const r = b.dataset.rk, q = rp.quem; rp.quem = null; if (r === 'voltar') return render(); agir('reagirRepel', q, r); });
  }
  function ligarReacao() {
    $('#modalCard').querySelectorAll('[data-quem]').forEach(b => b.onclick = () => { reac.quem = +b.dataset.quem; reac.fim = Math.max(reac.fim, Date.now() + 5000); render(); });
    $('#modalCard').querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const r = b.dataset.r, q = reac.quem; reac.quem = null; if (r === 'voltar') return render(); agir('reagir', q, r); });
  }
  function mCarta(pd, p) {
    const card = (pd.baralho === 'evento' ? E.idx().ev : E.idx().sev)[pd.carta];
    if (!pd.ativado && pd.reacao == null && souAnfitriao()) { E.iniciarReacoes(st); salvar(); }
    if (E.reacaoAberta(st)) {
      abrirModal(`<div class="mgrid"><img src="${card.img}"><div><h2>${esc(card.nome)}</h2><span class="tag">${pd.baralho === 'evento' ? 'Evento' : 'Super Evento'}</span> <span class="mut">ativado por ${esc(E.J(st, pd.reacao.ativador).nome)}</span>
        <p style="font-size:16px;margin:14px 0">${esc(card.texto)}</p>${janelaReacao(pd, card)}</div></div>`);
      ligarReacao(); return;
    }
    const auto = card.auto && card.auto.length;
    abrirModal(`<div class="mgrid"><img src="${card.img}"><div>
      <h2>${esc(card.nome)}</h2><span class="tag">${pd.baralho === 'evento' ? 'Evento' : 'Super Evento'}</span>${card.bloqueavel ? ' <span class="tag" style="color:#fca5a5">bloqueável por Poké-Boneca</span>' : ''}${card.continuado ? ` <span class="tag">continuado: ${card.continuado} turnos</span>` : ''}
      <p style="font-size:16px;margin:14px 0">${esc(card.texto)}</p>
      ${card.duelo ? `<p class="mut">Duelo — +1: ${card.duelo.mais1.map(t => E.TIPOS_NOME[t]).join(', ')} · −1: ${card.duelo.menos1.map(t => E.TIPOS_NOME[t]).join(', ')}</p>` : ''}
      ${pd.ativado && (st.ganhosCarta || []).length ? `<div class="ganhos surge"><div class="mut">Pokémon${st.ganhosCarta.length > 1 ? 's' : ''} recebido${st.ganhosCarta.length > 1 ? 's' : ''}:</div><div class="row" style="gap:12px;flex-wrap:wrap">${st.ganhosCarta.map(([j, id]) => `<div class="gpk"><img src="${E.P(id).img}" data-z="${E.P(id).img}"><div><b>${esc(E.P(id).nome)}</b>${j !== p.id || st.ganhosCarta.some(x => x[0] !== p.id) ? `<br><span class="mut">${esc(E.J(st, j).nome)}</span>` : ''}</div></div>`).join('')}</div></div>` : ''}
      ${pd.ativado ? `<div class="result">${card.autoCompleto ? 'Efeito aplicado.' : auto ? 'Efeitos automáticos aplicados. O anfitrião pode completar o que faltar pela caixa de ferramentas.' : 'Este efeito é aplicado à mão pela caixa de ferramentas.'}</div>` : ''}
      <div class="mfoot">
        ${!card.autoCompleto && souAnfitriao() ? '<button id="tools">Caixa de ferramentas</button>' : ''}
        ${!pd.ativado && auto ? '<button class="pri" id="atv">Ativar efeito</button>' : `<button class="pri" id="fim">Concluir ${pd.baralho === 'evento' ? 'Evento' : 'Super Evento'}</button>`}
      </div></div></div>`);
    const a = $('#atv'); if (a) a.onclick = () => agir('ativarCarta');
    $('#modalCard').querySelectorAll('.gpk img').forEach(i => i.onclick = () => zoom(i.dataset.z));
    const fm = $('#fim'); if (fm) fm.onclick = () => { esperandoHumano = false; agir('concluirCarta'); };
    const tl = $('#tools'); if (tl) tl.onclick = () => caixaFerramentas();
  }
  function mTravar(pd) {
    const p = E.J(st, pd.jogador != null ? pd.jogador : st.vez);
    const fams = {}; p.pokemon.forEach(id => { const c = E.P(id); const f = c.familia || id; (fams[f] = fams[f] || []).push(id); });
    abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">O mais evoluído da família recebe +1 permanente, e a família inteira fica protegida contra trocas.</p>
      <div class="pick">${Object.entries(fams).map(([f, ids]) => `<div class="pc ${p.travadas.includes(f) ? 'off' : ''}" data-f="${f}" title="${ids.map(i => E.P(i).nome).join(' + ')}"><img src="${E.P(ids.reduce((a, b) => E.P(b).estagio > E.P(a).estagio ? b : a)).img}"><span class="f">${ids.length}×</span></div>`).join('')}</div>`);
    $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('travar', c.dataset.f));
  }
  function linhaJogador(q, extra) { return `<div class="pc pj" data-p="${q.id}" style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--bg2);border:1px solid var(--line);cursor:pointer"><span class="dot" style="background:${COR_HEX[q.cor]}"></span><b style="flex:1">${esc(q.nome)}${q.ia ? ' 🤖' : ''}</b><span class="mut cnt">${q.pokemon.length} <img src="img/ui/pokebola.webp"> · ${q.itens.length} <img src="img/ui/item.webp"></span>${extra || ''}</div>`; }
  function nomeHex(k) { const hx = E.grafo(st).slots[k].pos; return D.hexes[st.layout[hx]].id.replace(/BR.*$/i, ''); }
  function mSlot(pd, p) {
    abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">${pd.opcoes.length} opção(ões). Cartas viradas mostram só a cor; o rótulo indica o hexágono.</p>
      <div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">${pd.opcoes.map(k => { const c = st.slots[k], pk = E.P(c.carta); return `<div class="pc" data-k="${k}" title="Hexágono ${nomeHex(k)}"><img src="${c.aberta ? pk.img : D.versos[E.grafo(st).slots[k].cor]}"><span class="f">${nomeHex(k)}${c.fraco ? ' · enfraq.' : ''}</span></div>`; }).join('')}</div>`);
    $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => agir('escolherSlot', c.dataset.k));
  }
  function mTipoCor(pd) {
    const S = sel.tc || (sel.tc = { tipo: null, cor: pd.cores[pd.cores.length - 1] });
    const conta = t => st.decks[S.cor].filter(id => E.P(id).tipos.includes(t)).length;
    abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">Você recebe o próximo Pokémon fora do jogo com esse tipo e essa cor. O número indica quantos ainda restam.</p>
      <div class="row" style="margin:10px 0">${pd.cores.map(c => `<button class="sm ${S.cor === c ? 'pri' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
      <div class="row">${Object.keys(E.TIPOS_NOME).map(t => `<button class="sm ${S.tipo === t ? 'pri' : ''}" data-t="${t}" ${conta(t) ? '' : 'disabled'}>${E.TIPOS_NOME[t]} (${conta(t)})</button>`).join('')}</div>
      <div class="mfoot"><button class="pri" id="tcok" ${S.tipo && conta(S.tipo) ? '' : 'disabled'}>Pegar</button></div>`);
    $('#modalCard').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { S.cor = b.dataset.c; render(); });
    $('#modalCard').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.tipo = b.dataset.t; render(); });
    $('#tcok').onclick = () => { const t = S.tipo, c = S.cor; sel.tc = null; agir('resolverTipoCor', t, c); };
  }
  function mPagar(pd, p) {
    const esc2 = sel.pag || (sel.pag = []);
    abrirModal(`<h2>${esc(pd.titulo)}</h2><div class="hand">${p.itens.map(i => `<div class="ic ${esc2.includes(i) ? 'sel' : ''}" data-i="${i}" style="width:96px"><img src="${E.ITEM(i).img}"></div>`).join('')}</div>
      <div class="mfoot"><button class="pri" id="pg" ${esc2.length === pd.n ? '' : 'disabled'}>Descartar ${pd.n}</button></div>`);
    $('#modalCard').querySelectorAll('.ic').forEach(c => c.onclick = () => { const i = c.dataset.i, k = esc2.indexOf(i); if (k >= 0) esc2.splice(k, 1); else if (esc2.length < pd.n) esc2.push(i); render(); });
    $('#pg').onclick = () => { const e = esc2.slice(); sel.pag = null; agir('pagarItens', e); };
  }
  function mNegociador(pd, p) {
    const S = sel.neg || (sel.neg = []);
    const ok = S.length === 2 && E.P(S[0]).cor === E.P(S[1]).cor;
    abrirModal(`<h2>${esc(pd.titulo)}</h2><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">${p.pokemon.filter(id => !['inicial', 'amarelo'].includes(E.P(id).cor)).map(id => cartaPokemon(p, id, S.includes(id) ? 'sel' : '')).join('')}</div>
      <div class="mfoot"><button id="ngn">Não trocar</button><button class="pri" id="ngs" ${ok ? '' : 'disabled'}>Devolver os 2 e ganhar 1</button></div>`);
    $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => { const id = c.dataset.id, k = S.indexOf(id); if (k >= 0) S.splice(k, 1); else { if (S.length >= 2) S.shift(); S.push(id); } render(); });
    $('#ngn').onclick = () => { sel.neg = null; agir('resolverNegociador', null); };
    $('#ngs').onclick = () => { const e = S.slice(); sel.neg = null; agir('resolverNegociador', e); };
  }
  function mAlvo(pd, p) {
    abrirModal(`<h2>${esc(pd.titulo)}</h2>${pd.bloqueavel ? '<p class="mut">Este efeito pode ser bloqueado por Poké-Boneca.</p>' : ''}
      <div style="display:grid;gap:8px">${pd.opcoes.map(i => { const q = E.J(st, i); const t = q.treinador && E.idx().tr[q.treinador]; return linhaJogador(q, `${q.id === p.id ? '<span class="tag">você</span>' : ''}<span class="mut">${t ? esc(t.nome) : ''}</span>${insignias(q, true)}`); }).join('')}</div>`);
    $('#modalCard').querySelectorAll('.pj').forEach(c => c.onclick = () => agir('escolherAlvo', +c.dataset.p));
  }
  let brineyTimer = null, treinTimer = null, junTimer = null, festTimer = null;
  function mBriney(pd, p) {
    const dono = E.J(st, pd.dono);
    if (dono.ia && !p.ia) {
      if (!brineyTimer) brineyTimer = setTimeout(() => { brineyTimer = null; if (st.pend && st.pend.tipo === 'briney') agirIA('resolverBriney', window.AI.decidirBriney(st)); }, 700);
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(dono.nome)} está decidindo…</p>`); return;
    }
    abrirModal(`<h2>⛵ ${esc(pd.titulo)}</h2><p class="mut">${dono.id !== p.id ? 'Passe o dispositivo para ' + esc(dono.nome) + '.' : ''}</p>
      <div class="dice">${[-1, 0, 1].map(d => `<button class="${d === 0 ? '' : 'pri'}" data-d="${d}" style="min-width:110px">${d > 0 ? '+1' : d < 0 ? '−1' : 'manter'} → ${Math.max(1, pd.valor + d)}</button>`).join('')}</div>`);
    $('#modalCard').querySelectorAll('[data-d]').forEach(b => b.onclick = () => agir('resolverBriney', +b.dataset.d));
  }
  let bonecaTimer = null;
  function mBoneca(pd) {
    const r = E.J(st, pd.respondente), atk = E.J(st), alvo = E.J(st, pd.alvo);
    if (r.ia && !E.J(st).ia) { // humano jogando, IA decide se usa a Boneca
      if (!bonecaTimer) bonecaTimer = setTimeout(() => { bonecaTimer = null; if (st.pend && st.pend.tipo === 'boneca' && E.J(st, st.pend.respondente).ia) agirIA('responderBoneca', window.AI.decidirBoneca(st)); }, 700);
      abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">🤖 ${esc(r.nome)} está decidindo…</p>`); return;
    }
    const txt = pd.respondente === pd.alvo ? `${esc(atk.nome)} quer aplicar <b>${esc(pd.acao)}</b> em você.` : `${esc(alvo.nome)} bloqueou com Poké-Boneca. Usar a sua para anular a dele?`;
    abrirModal(`<div class="mgrid"><img src="${E.ITEM(E.temBoneca(r)).img}"><div><h2>${esc(pd.titulo)}</h2><p>${txt}</p><p class="mut">Passe o dispositivo para <b>${esc(r.nome)}</b>.</p>
      <div class="mfoot"><button id="nb">Não usar</button><button class="pri" id="sb">Usar Poké-Boneca</button></div></div></div>`);
    $('#nb').onclick = () => agir('responderBoneca', false); $('#sb').onclick = () => agir('responderBoneca', true);
  }
  function mTroca(pd, p) {
    const q = E.J(st, pd.com), pares = E.paresTroca(p, q, pd.cores), S = sel.troca || (sel.troca = { meu: null, dele: null });
    const meus = [...new Set(pares.map(x => x[0]))], deles = pares.filter(x => !S.meu || x[0] === S.meu).map(x => x[1]);
    const ok = S.meu && S.dele && pares.some(x => x[0] === S.meu && x[1] === S.dele);
    abrirModal(`<h2>${esc(pd.titulo)}</h2><p class="mut">Famílias travadas não podem ser trocadas.${pd.ssanne ? ' Depois da troca, ' + esc(q.nome) + ' compra 2 Itens.' : ''}</p>
      <h3 style="margin-top:12px">Seu Pokémon</h3><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">${meus.map(id => cartaPokemon(p, id, S.meu === id ? 'sel' : '')).join('')}</div>
      <h3 style="margin-top:12px">Pokémon de ${esc(q.nome)}</h3><div class="pick" id="dl" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">${[...new Set(deles)].map(id => cartaPokemon(q, id, S.dele === id ? 'sel' : '')).join('')}</div>
      <div class="mfoot"><button class="pri" id="tk" ${ok ? '' : 'disabled'}>Trocar</button></div>`);
    $('#modalCard').querySelectorAll('.pick:not(#dl) .pc').forEach(c => c.onclick = () => { S.meu = c.dataset.id; if (!pares.some(x => x[0] === S.meu && x[1] === S.dele)) S.dele = null; render(); });
    $('#dl').querySelectorAll('.pc').forEach(c => c.onclick = () => { S.dele = c.dataset.id; render(); });
    $('#tk').onclick = () => { const a = S.meu, b = S.dele; sel.troca = null; agir('resolverTroca', a, b); };
  }
  let animDu = { feito: null, timer: null };
  function arenaDuelo(pd, r, animando) {
    const lado = l => {
      const d = r.det[l], q = E.J(st, pd[l]), c = E.P(d.pokemon), dado = l === 'a' ? r.da : r.db, tot = l === 'a' ? r.fa : r.fb;
      const venceu = r.venc === pd[l], perdeu = r.venc != null && !venceu;
      const linha = (rot, v, extra) => v ? `<div class="ln"><span>${rot}${extra || ''}</span><b>${v > 0 ? '+' : ''}${v}</b></div>` : '';
      return `<div class="lado ${animando ? '' : venceu ? 'venc' : perdeu ? 'perd' : 'emp'}">
        <div class="quem"><span class="dot" style="background:${COR_HEX[q.cor]}"></span>${esc(q.nome)}${!animando && venceu ? ' <span class="selo ok">VENCEU</span>' : !animando && perdeu ? ' <span class="selo no">PERDEU</span>' : ''}</div>
        <img class="carta" src="${c.img}">
        <div class="calc">
          <div class="ln"><span>Força de ${esc(c.nome)}</span><b>${d.base}</b></div>
          ${linha('Evolução / +1', d.evol)}${linha('Treinador', d.trein)}${linha('Vantagem de tipo', d.vant)}${linha('Local do duelo', d.local)}
          ${d.itemId ? `<div class="ln"><span><img class="miniItem" src="${E.idx().it[d.itemId].img}"> ${esc(E.idx().it[d.itemId].nome)}</span><b>${d.item ? '+' + d.item : '+0'}</b></div>` : ''}
          <div class="ln sub"><span>Força</span><b>${d.forca}</b></div>
        </div>
        <div class="rolling ${animando ? '' : 'final'}"><div class="die3d ${animando ? '' : 'parou ' + (venceu ? 'ok' : perdeu ? 'no' : '')}"><span>${animando ? 1 + Math.floor(Math.random() * 6) : dado}</span></div>
          <div class="tot">${animando ? '<span class="mut">rolando…</span>' : `<span class="mut">${d.forca} + ${dado} =</span> <b>${tot}</b>`}</div></div>
      </div>`;
    };
    return `<div class="arena">${lado('a')}<div class="vs">VS</div>${lado('b')}</div>`;
  }
  function mDuelo(pd) {
    const S = sel.duelo && sel.duelo.k === pd.a + '-' + pd.b + '-' + pd.fora.length ? sel.duelo : (sel.duelo = { k: pd.a + '-' + pd.b + '-' + pd.fora.length, a: {}, b: {} });
    const r = pd.resultado, fim = r && (r.venc != null || r.fim);
    const chave = r ? r.seq + ':' + pd.fora.length : null, animando = !!(r && r.det && animDu.feito !== chave);
    if (animando && !animDu.timer) {
      const giro = setInterval(() => document.querySelectorAll('.arena .die3d span').forEach(x => x.textContent = 1 + Math.floor(Math.random() * 6)), 70);
      animDu.timer = setTimeout(() => { clearInterval(giro); animDu.timer = null; animDu.feito = chave; render(); }, 800);
    }
    ['a', 'b'].forEach(l => { if (E.J(st, pd[l]).ia && !(pd.escolhas && pd.escolhas[l]) && !fim && !animando && !E.J(st).ia) { const k = 'du' + st.log.length + l; if (!ligaTimers[k]) ligaTimers[k] = setTimeout(() => { if (st.pend === pd) agirIA('escolherDuelo', l, window.AI.escolhaDuelo(st, l)); }, 400); } });
    const ladoPronto = l => (pd.escolhas && pd.escolhas[l]) || E.J(st, pd[l]).ia || !souEu(pd[l]) || S[l].pokemon;
    const meuLadoFeito = online() && ['a', 'b'].some(l => pd[l] === NET.eu && pd.escolhas && pd.escolhas[l]);
    const lado = l => { const q = E.J(st, pd[l]); if (q.ia || !souEu(q.id) || (online() && pd.escolhas && pd.escolhas[l])) return `<div><h3>${esc(q.nome)}${q.ia ? ' 🤖' : ''}</h3><p class="mut">${pd.escolhas && pd.escolhas[l] ? '✔ Escolha feita.' : q.ia ? 'Escolha feita em segredo.' : 'Escolhendo em segredo…'}</p></div>`;
      const its = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus);
      return `<div><h3>${esc(q.nome)}</h3><div class="ligaPick">${timeAgrupado(q, 70, { ids: E.aptosDuelo(st, pd, l), carta: id => `<div class="pc ${S[l].pokemon === id ? 'sel' : ''}" data-l="${l}" data-id="${id}" title="${esc(E.P(id).nome)}"><img src="${E.P(id).img}"><span class="f">${E.forcaEmBatalha(st, q.id, id, null, [], pd.mods)}</span></div>` })}</div>
        <select data-i="${l}" style="margin-top:8px;width:100%"><option value="">— sem item —</option>${its.map(i => `<option value="${i}" ${S[l].item === i ? 'selected' : ''}>${esc(E.ITEM(i).nome)} (+${E.ITEM(i).bonus})</option>`).join('')}</select></div>`; };
    const premioTxt = { dojo: 'um Pokémon Azul aleatório', estufa: 'dois Pokémons Verdes aleatórios', gelo: 'escolher entre os 2 próximos Eventos', vulcao: '3 Itens e 1 Treinador' }[pd.premio];
    const msg = !r || animando ? '' : r.venc != null ? `🏆 ${esc(E.J(st, r.venc).nome)} vence o duelo!${premioTxt ? ' Prêmio: ' + premioTxt + '.' : ''}` : r.fim ? 'Ninguém tem mais Pokémons: duelo sem vencedor.' : 'Empate — os dois Pokémons desmaiam. Escolham outros.';
    abrirModal(`<h2>⚔ ${esc(pd.titulo)}</h2><p class="mut">${pd.mods ? `Local — +1: ${pd.mods.mais1.map(t => E.TIPOS_NOME[t]).join(', ')} · −1: ${pd.mods.menos1.map(t => E.TIPOS_NOME[t]).join(', ')}. ` : ''}${premioTxt ? 'Prêmio do vencedor: ' + premioTxt + '.' : ''}${!r ? ' Entre dois humanos, cada um escolhe sem o outro olhar.' : ''}</p>
      ${r && r.det ? arenaDuelo(pd, r, animando) : ''}
      ${msg ? `<div class="result surge ${r.venc != null ? 'ok' : ''}"><b class="big">${msg}</b></div>` : ''}
      ${!fim && !animando ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:10px">${lado('a')}${lado('b')}</div>` : ''}
      ${r && r.det && !animando && !E.J(st, pd.a).ia && E.celebiDe(E.J(st, pd.a)) ? `<div class="row celebiRow"><span class="mut">🌸 ${esc(E.J(st, pd.a).nome)}, usar Pedido a Celebi?</span><button class="celebi" data-cd="a">Refazer meu dado (${r.da})</button><button class="celebi" data-cd="b">Refazer o dado de ${esc(E.J(st, pd.b).nome)} (${r.db})</button></div>` : ''}
      <div class="mfoot">${animando ? '' : fim ? '<button class="pri" id="dc">Continuar</button>' : (meuLadoFeito ? '<span class="mut">⏳ Aguardando o adversário…</span>' : `<button class="pri" id="dg" ${ladoPronto('a') && ladoPronto('b') ? '' : 'disabled'}>${online() ? '✔ Confirmar minha escolha' : '🎲 Batalhar'}</button>`)}</div>`);
    $('#modalCard').querySelectorAll('[data-l]').forEach(c => c.onclick = () => { S[c.dataset.l].pokemon = c.dataset.id; render(); });
    $('#modalCard').querySelectorAll('[data-i]').forEach(x => x.onchange = () => { S[x.dataset.i].item = x.value || null; });
    const g = $('#dg'); if (g) g.onclick = () => { const a = S.a, b = S.b; sel.duelo = null; ['a', 'b'].forEach(l => { const e = l === 'a' ? a : b; if (!E.J(st, pd[l]).ia && souEu(pd[l]) && e.pokemon && !(pd.escolhas && pd.escolhas[l])) agir('escolherDuelo', l, e); }); };
    const c = $('#dc'); if (c) c.onclick = () => { sel.duelo = null; agir('fecharDuelo'); };
    $('#modalCard').querySelectorAll('[data-cd]').forEach(b => b.onclick = () => agir('celebiDuelo', b.dataset.cd));
  }
  function mDescartar(pd, p) {
    const escolhidos = sel.desc || (sel.desc = []);
    abrirModal(`<h2>${esc(pd.titulo)}</h2><div class="hand">${p.itens.map(i => `<div class="ic ${escolhidos.includes(i) ? 'sel' : ''}" data-i="${i}" title="${esc(E.ITEM(i).nome)}" style="width:96px"><img src="${E.ITEM(i).img}"></div>`).join('')}</div>
      <div class="mfoot"><button class="pri" id="ok" ${escolhidos.length === pd.n ? '' : 'disabled'}>Descartar ${pd.n}</button></div>`);
    $('#modalCard').querySelectorAll('.ic').forEach(c => c.onclick = () => { const i = c.dataset.i, k = escolhidos.indexOf(i); if (k >= 0) escolhidos.splice(k, 1); else if (escolhidos.length < pd.n) escolhidos.push(i); render(); });
    $('#ok').onclick = () => { const e = escolhidos.slice(); sel.desc = null; agir('descartarExcesso', e); };
  }
  let animLd = { feito: null, timer: null };
  function mLider(pd, p) {
    const L = E.idx().ld[pd.lider], r = pd.resultado, n = L.dual ? 2 : 1;
    sel.lider = sel.lider && sel.lider.key === pd.cidade + pd.lider ? sel.lider : { key: pd.cidade + pd.lider, pk: [], it: {} };
    const S = sel.lider;
    const aptos = p.pokemon.filter(id => E.obedece(p, E.P(id).cor));
    const prev = id => E.forcaBase(p, id) + E.bonusTreinador(p, id) + (E.P(id).vantagens.includes(L.tipo) ? 2 : 0) + (S.it[id] ? (E.ITEM(S.it[id]).bonus && (!E.ITEM(S.it[id]).tipos || E.P(id).tipos.some(t => E.ITEM(S.it[id]).tipos.includes(t))) ? E.ITEM(S.it[id]).bonus : 0) : 0);
    const itensBat = p.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus);
    const usados = Object.values(S.it);
    const remedios = p.itens.filter(i => i.startsWith('potion#'));
    const liderVs = S.pk.reduce((s, id) => s + E.P(id).tipos.filter(t => L.vantagens.includes(t)).length * 2, 0);
    const chave = r ? r.seq : null, animando = !!(r && r.det && r.det[0] && r.det[0].forca != null && animLd.feito !== chave);
    if (animando && !animLd.timer) {
      const giro = setInterval(() => document.querySelectorAll('.arena .die3d span').forEach(x => x.textContent = 1 + Math.floor(Math.random() * 6)), 70);
      animLd.timer = setTimeout(() => { clearInterval(giro); animLd.timer = null; animLd.feito = chave; render(); }, 800);
    }
    if (r && r.det && r.det[0] && r.det[0].forca != null) {
      const linha = (rot, v) => v ? `<div class="ln"><span>${rot}</span><b>${v > 0 ? '+' : ''}${v}</b></div>` : '';
      const forcaPk = d => d.base + d.v + d.tr + d.it;
      const ladoJog = `<div class="lado ${animando ? '' : r.ok ? 'venc' : 'perd'}">
        <div class="quem"><span class="dot" style="background:${COR_HEX[p.cor]}"></span>${esc(p.nome)}${animando ? '' : r.ok ? ' <span class="selo ok">VENCEU</span>' : ' <span class="selo no">PERDEU</span>'}</div>
        <div class="row" style="justify-content:center;gap:10px">${r.det.map(d => `<img class="carta" src="${E.P(d.id).img}" style="${r.det.length > 1 ? 'width:100px' : ''}">`).join('')}</div>
        ${r.det.map(d => `<div class="calc"><div class="ln"><span>Força de ${esc(E.P(d.id).nome)}</span><b>${d.forca}</b></div>${linha('Evolução / +1', d.evol)}${linha('Treinador', d.tr)}${linha('Vantagem contra ' + E.TIPOS_NOME[L.tipo], d.v)}
          ${d.itemId ? `<div class="ln"><span><img class="miniItem" src="${E.idx().it[d.itemId].img}"> ${esc(E.idx().it[d.itemId].nome)}</span><b>+${d.it}</b></div>` : ''}
          ${r.det.length > 1 ? `<div class="ln sub" style="font-size:13px"><span>Subtotal</span><b>${forcaPk(d)}</b></div>` : ''}</div>`).join('')}
        <div class="calc"><div class="ln sub"><span>Força${r.det.length > 1 ? ' (dupla)' : ''}</span><b>${r.total - r.dado}</b></div></div>
        <div class="rolling ${animando ? '' : 'final'}"><div class="die3d ${animando ? '' : 'parou ' + (r.ok ? 'ok' : 'no')}"><span>${animando ? 1 + Math.floor(Math.random() * 6) : r.dado}</span></div>
          <div class="tot">${animando ? '<span class="mut">rolando…</span>' : `<span class="mut">${r.total - r.dado} + ${r.dado} =</span> <b>${r.total}</b>`}</div></div></div>`;
      const ladoLid = `<div class="lado ${animando ? '' : r.ok ? 'perd' : 'venc'}">
        <div class="quem">Líder ${esc(L.nome)}${animando ? '' : r.ok ? ' <span class="selo no">PERDEU</span>' : ' <span class="selo ok">VENCEU</span>'}</div>
        <img class="carta" src="${L.img}">
        <div class="calc"><div class="ln"><span>Força fixa${L.dual ? ' (DUAL)' : ''}</span><b>${L.forca}</b></div>
          ${r.det.map(d => d.lv ? `<div class="ln"><span>Vantagem contra ${esc(E.P(d.id).nome)}</span><b>+${d.lv}</b></div>` : '').join('')}
          <div class="ln sub"><span>Total</span><b>${r.lider}</b></div></div>
        <div class="rolling final"><div class="tot"><span class="mut">Líderes não rolam dado</span></div></div></div>`;
      abrirModal(`<h2>⚔ ${esc(pd.titulo)}</h2><p class="mut">Tipo ${E.TIPOS_NOME[L.tipo]} · em caso de empate, o jogador vence.</p>
        <div class="arena">${ladoJog}<div class="vs">VS</div>${ladoLid}</div>
        ${animando ? '' : `<div class="result surge ${r.ok ? 'ok' : 'no'}"><b class="big">${r.ok ? `🏅 Vitória! ${r.total === r.lider ? '(empate conta a seu favor) ' : ''}` : 'Derrota'}</b>${r.ok ? 'Você ganhou a insígnia e compra uma Carta Item.' : 'Você pode tentar de novo em outro turno.'}</div>`}
        <div class="mfoot">${animando ? '' : `${!r.ok && E.celebiDe(p) && !p.ia ? '<button class="celebi" id="celL">🌸 Pedido a Celebi: refazer o dado</button>' : ''}${!r.ok && remedios.length ? `<button id="rem">Usar Remédio (recomeçar)</button>` : ''}<button class="pri" id="ok">Continuar</button>`}</div>`);
    } else
    abrirModal(`<div class="mgrid"><img src="${L.img}"><div>
      <h2>${esc(pd.titulo)}</h2><div class="mut">Tipo ${E.TIPOS_NOME[L.tipo]} · força fixa ${L.forca}${L.dual ? ' · <b>DUAL</b>: envie 2 Pokémons, 1 dado, até 2 itens' : ''} · vantagem contra ${L.vantagens.map(t => E.TIPOS_NOME[t]).join(', ') || '—'}</div>
      ${!r ? `<p style="margin:12px 0 6px">Escolha ${n} Pokémon${n > 1 ? 's' : ''} <span class="mut">(só os que obedecem)</span>:</p>
        <div class="ligaPick">${aptos.length ? timeAgrupado(p, 84, { ids: aptos, carta: id => `<div class="pc ${S.pk.includes(id) ? 'sel' : ''}" data-id="${id}" title="${esc(E.P(id).nome)}"><img src="${E.P(id).img}"><span class="f">${prev(id)}</span></div>` }) : '<span class="mut">Nenhum Pokémon apto.</span>'}</div>
        ${S.pk.length && itensBat.length ? `<p style="margin:12px 0 6px">Item de batalha (um por Pokémon):</p>${S.pk.map(id => `<div class="row" style="margin-bottom:6px"><span style="width:110px">${esc(E.P(id).nome)}</span><select data-it="${id}"><option value="">— nenhum —</option>${itensBat.filter(i => !usados.includes(i) || S.it[id] === i).map(i => `<option value="${i}" ${S.it[id] === i ? 'selected' : ''}>${esc(E.ITEM(i).nome)} (+${E.ITEM(i).bonus}${E.ITEM(i).tipos ? ' ' + E.ITEM(i).tipos.map(t => E.TIPOS_NOME[t]).join('/') : ''})</option>`).join('')}</select></div>`).join('')}` : ''}
        ${S.pk.length === n ? `<div class="result">Sua força antes do dado: <b>${S.pk.reduce((s, id) => s + prev(id), 0)}</b> · Líder: <b>${L.forca + liderVs}</b>${liderVs ? ` (inclui +${liderVs} de vantagem)` : ''}. Empate = vitória sua.</div>` : ''}` : ''}
      ${r && false ? `<div class="result ${r.ok ? 'ok' : 'no'}"><b class="big">${r.ok ? 'Vitória!' : 'Derrota'}</b>
        <table class="breakdown">${r.det.map(d => `<tr><td>${esc(E.P(d.id).nome)}</td><td>${d.base} base${d.v ? ` +${d.v} vantagem` : ''}${d.tr ? ` +${d.tr} treinador` : ''}${d.it ? ` +${d.it} item` : ''}</td></tr>`).join('')}<tr><td>Dado</td><td>${r.dado}</td></tr><tr><td><b>Total</b></td><td><b>${r.total}</b> × <b>${r.lider}</b> ${esc(L.nome)}</td></tr></table>
        ${r.ok ? '<p>Você ganhou a insígnia e compra uma Carta Item.</p>' : ''}</div>` : ''}
      <div class="mfoot">
        ${!r ? `<button data-x2>Desistir</button><button class="pri" id="bat" ${S.pk.length === n ? '' : 'disabled'}>⚔ Batalhar</button>` : ''}
        ${r && !r.ok && remedios.length ? `<button id="rem">Usar Remédio (recomeçar)</button>` : ''}
        ${r ? `<button class="pri" id="ok">Continuar</button>` : ''}
      </div></div></div>`);
    $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => { const id = c.dataset.id, k = S.pk.indexOf(id); if (k >= 0) { S.pk.splice(k, 1); delete S.it[id]; } else if (S.pk.length < n) S.pk.push(id); else { delete S.it[S.pk.shift()]; S.pk.push(id); } render(); });
    $('#modalCard').querySelectorAll('[data-it]').forEach(s => s.onchange = () => { if (s.value) S.it[s.dataset.it] = s.value; else delete S.it[s.dataset.it]; render(); });
    const b = $('#bat'); if (b) b.onclick = () => { const pk = S.pk.slice(), it = pk.map(id => S.it[id] || null); sel.lider = null; agir('lutarLider', pk, it); };
    const x = $('[data-x2]'); if (x) x.onclick = () => { sel.lider = null; agir('fecharPend'); };
    const rm = $('#rem'); if (rm) rm.onclick = () => agir('remedio', remedios[0]);
    const cl = $('#celL'); if (cl) cl.onclick = () => agir('celebiLider');
    const ok = $('#ok'); if (ok) ok.onclick = () => { sel.lider = null; agir('fecharPend'); };
  }
  function modalItem(inst) {
    const it = E.ITEM(inst), p = E.J(st);
    const automatico = ['bike1', 'pokenavplus', 'lura', 'doceraro', 'potedemel', 'truquerocket', 'vara', 'voar'].includes(it.id);
    abrirModal(`<div class="mgrid"><img src="${it.img}"><div><h2>${esc(it.nome)}</h2>
      <span class="tag">${{ comum: 'Comum — só no seu turno', rapido: 'Rápido — a qualquer momento', batalha: 'Batalha — só em batalhas' }[it.uso]}</span>
      <p style="font-size:15px">${esc(it.texto)}</p>
      <p class="mut">${it.bola ? 'Bolas são usadas na janela de captura.' : it.uso === 'batalha' ? 'Itens de batalha são escolhidos na janela de batalha.' : ['corda', 'escaperope'].includes(it.id) ? 'Use depois de rolar o dado, pelos botões no painel do turno.' : it.id === 'pedidocelebi' ? 'Use pelos botões 🌸 que aparecem depois das rolagens: movimento, captura, batalha de Ginásio, Duelos e Eventos de dado.' : automatico ? '' : 'Ao usar, o item é descartado; aplique o efeito com a caixa de ferramentas.'}</p>
      <div class="mfoot"><button data-x>Fechar</button>${!it.bola && it.uso !== 'batalha' && !['corda', 'escaperope', 'pedidocelebi'].includes(it.id) ? `<button class="pri" id="usar">Usar ${esc(it.nome)}</button>` : ''}</div></div></div>`);
    const u = $('#usar'); if (u) u.onclick = () => { fecharModal(); agir('usarItem', inst); if (!automatico) caixaFerramentas(); };
  }
  function modalJogador(i) {
    const q = E.J(st, i), tr = q.treinador && E.idx().tr[q.treinador];
    abrirModal(`<h2><span class="dot" style="display:inline-block;vertical-align:middle;background:${COR_HEX[q.cor]}"></span> ${esc(q.nome)}</h2>
      <div class="row" style="margin:8px 0 14px">${insignias(q)}<span class="mut">${q.itens.length} itens · ${q.capturas} capturas${q.planalto ? ' · chegou ao Planalto' : ''}</span></div>
      ${timeAgrupado(q, 90)}
      ${tr ? `<div class="trainer"><img src="${tr.img}"><div><b>${esc(tr.nome)}</b><p>${esc(tr.texto)}</p></div></div>` : ''}
      <div class="mfoot">${NET.modo === 'host' && q.id !== NET.eu ? `<button id="mjIA">${q.ia ? '🙂 Devolver o lugar ao jogador' : '🤖 Passar este lugar para a IA'}</button>` : ''}<button class="pri" data-x>Fechar</button></div>`);
    const mj = $('#mjIA'); if (mj) mj.onclick = () => { q.ia = !q.ia; if (!q.ia) q.remoto = true; salvar(); fecharModal(); render(); NET.difundir && NET.difundir(); };
    $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => zoom(E.P(c.dataset.id).img));
  }

  // ---------- rolagens de Eventos (Pescaria, Cassino, Safari, Encontro Raro) ----------
  let rolVista = null, rolTimer = null;
  function verRolagem() {
    if (!st) return; const r = st.rolagem; if (rolVista == null) { rolVista = r ? r.seq : 0; return; }
    if (!r || r.seq <= rolVista || rolTimer) return;
    rolVista = r.seq; const fx = $('#dadoFx');
    fx.innerHTML = `<div class="fxCard"><div class="mut">${esc(r.titulo)} · ${esc(r.jogador)}</div><div class="rolling"><div class="die3d"><span>${1 + Math.floor(Math.random() * 6)}</span></div><span class="mut">rolando…</span></div></div>`;
    fx.hidden = false;
    const giro = setInterval(() => { const sp = $('#dadoFx .die3d span'); if (sp) sp.textContent = 1 + Math.floor(Math.random() * 6); }, 70);
    rolTimer = setTimeout(() => {
      clearInterval(giro);
      fx.innerHTML = `<div class="fxCard"><div class="mut">${esc(r.titulo)} · ${esc(r.jogador)}</div><div class="rolling final"><div class="die3d parou ${r.ok ? 'ok' : 'no'}"><span>${r.valor}</span></div><div class="result surge ${r.ok ? 'ok' : 'no'}" style="margin:0;flex:1"><b class="big">${r.valor}</b>${esc(r.texto)}</div></div><div class="mut" style="font-size:11px;margin-top:6px">clique para fechar</div></div>`;
      let auto = null; const fim = () => { clearTimeout(auto); if (rolTimer === auto) { fx.hidden = true; fx.onclick = null; rolTimer = null; } agendarIA(); };
      fx.onclick = fim; auto = rolTimer = setTimeout(fim, 2200);
    }, 800);
  }

  // ---------- resultado do Parque Nacional ----------
  let parqueVisto = null;
  function verParque() {
    if (!st) return; const R = st.resultadoParque; if (parqueVisto == null) { parqueVisto = R ? R.seq : 0; return; }
    if (!R || R.seq <= parqueVisto || rolTimer) return;
    parqueVisto = R.seq; const fx = $('#parqueFx'); const med = ['🥇', '🥈', '🥉'];
    fx.innerHTML = `<div class="fxCard parque"><h2>🌳 Parque Nacional — resultado final</h2><p class="mut">Ativado por ${esc(E.J(st, R.dono).nome)} · capturas durante as 3 rodadas (desempate pela soma das forças)</p>
      <table class="tabParque"><thead><tr><th></th><th>Jogador</th><th>Capturas</th><th>Pokémons</th><th>Prêmio</th></tr></thead><tbody>
      ${R.linhas.map(l => { const q = E.J(st, l.jogador); return `<tr class="${l.lugar ? 'premiado' : ''}"><td class="med">${l.lugar ? med[l.lugar - 1] : ''}</td>
        <td><span class="dot" style="display:inline-block;width:12px;height:12px;vertical-align:middle;background:${COR_HEX[q.cor]}"></span> ${esc(q.nome)}</td>
        <td><b>${l.n}</b>${l.n ? ` <span class="mut">(força ${l.f})</span>` : ''}</td>
        <td class="mini">${l.ids.map(id => `<img src="${E.P(id).img}" title="${esc(E.P(id).nome)}">`).join('') || '<span class="mut">—</span>'}</td>
        <td>${l.premio ? `${l.premio.pk ? `<img class="miniP" src="${E.P(l.premio.pk).img}"> ` : ''}${(l.premio.itens || []).map(i => `<img class="miniP" src="${E.ITEM(i).img}" title="${esc(E.ITEM(i).nome)}">`).join('')} ${esc(l.premio.texto)}` : '<span class="mut">—</span>'}</td></tr>`; }).join('')}
      </tbody></table><div class="mfoot"><button class="pri" id="pqOk">Fechar</button></div></div>`;
    fx.hidden = false; $('#pqOk').onclick = () => { fx.hidden = true; agendarIA(); };
  }

  // ---------- cartas citadas no registro ----------
  function refCarta(t, id) {
    const X = E.idx();
    if (t === 'ev') return X.ev[id]; if (t === 'sev') return X.sev[id]; if (t === 'tr') return X.tr[id]; if (t === 'ld') return X.ld[id]; if (t === 'it') return X.it[id]; if (t === 'pk') return E.P(id);
  }
  function logHtml(l) {
    let html = esc(l.msg);
    (l.refs || []).forEach(([t, id]) => { const c = refCarta(t, id); if (!c) return; const nome = esc(c.nome); const k = html.indexOf(nome); if (k < 0) return;
      html = html.slice(0, k) + `<span class="ref" data-t="${t}" data-id="${esc(id)}">${nome}</span>` + html.slice(k + nome.length); });
    return html;
  }
  function dicaCarta(ev, t, id) {
    const c = refCarta(t, id); if (!c) return; const tp = $('#tip');
    const txt = c.texto || (t === 'pk' ? `Força ${c.forca} · ${c.tipos.map(x => E.TIPOS_NOME[x]).join('/')} · ${c.cor}` : t === 'ld' ? `Força ${c.forca}${c.dual ? ' · DUAL' : ''} · ${E.TIPOS_NOME[c.tipo]} · insígnia ${c.insignias}` : '');
    tp.innerHTML = `<img src="${c.img}"><div><b>${esc(c.nome)}</b><br>${esc(txt)}<br><span class="mut">clique para ampliar</span></div>`; tp.hidden = false; moverDica(ev);
  }
  // ---------- líderes ----------
  function dica(ev, L, k) {
    const t = $('#tip'), n = E.grafo(st).nodes[k], c = n.cidade || {};
    const venc = st.jogadores.filter(q => q.lideresVencidos.includes(L.id)).map(q => q.nome);
    t.innerHTML = `<img src="${L.img}"><div><b>${esc(c.nome || '')}</b> · Líder <b>${esc(L.nome)}</b><br>Força <b>${L.forca}</b>${L.dual ? ' · DUAL' : ''} · ${E.TIPOS_NOME[L.tipo]} · insígnia ${L.insignias}<br><span class="mut">Vantagem contra: ${L.vantagens.map(x => E.TIPOS_NOME[x]).join(', ') || '—'}</span>${venc.length ? `<br><span class="mut">Vencido por: ${venc.map(esc).join(', ')}</span>` : ''}</div>`;
    t.hidden = false; moverDica(ev);
  }
  function moverDica(ev) { const t = $('#tip'); const x = ev.clientX + 18 + t.offsetWidth > innerWidth - 10 ? Math.max(10, ev.clientX - t.offsetWidth - 18) : ev.clientX + 18, y = Math.min(ev.clientY + 18, innerHeight - t.offsetHeight - 10); t.style.left = x + 'px'; t.style.top = y + 'px'; }
  function modalLiderInfo(k) {
    $('#tip').hidden = true;
    const L = E.idx().ld[st.lideres[k]], n = E.grafo(st).nodes[k], c = n.cidade || {}, p = E.J(st);
    const pio = st.pioneiros[k] != null ? E.J(st, st.pioneiros[k]).nome : null;
    const venc = st.jogadores.filter(q => q.lideresVencidos.includes(L.id)).map(q => q.nome);
    const pl = !p.ia && window.AI ? window.AI.planoLider(st, p, L) : null;
    abrirModal(`<div class="mgrid"><img src="${L.img}"><div><h2>${esc(c.nome)} · ${esc(L.nome)}</h2>
      <div class="mut">Força fixa <b>${L.forca}</b>${L.dual ? ' · <b>DUAL</b> (2 Pokémons, 1 dado, até 2 itens)' : ''} · tipo ${E.TIPOS_NOME[L.tipo]} · insígnia ${L.insignias}</div>
      <p>Vantagem (+2) contra: <b>${L.vantagens.map(x => E.TIPOS_NOME[x]).join(', ') || 'nenhum tipo'}</b></p>
      ${c.pioneiro ? `<p><b>Pioneiro:</b> ${esc(c.pioneiro)} ${pio ? `<span class="tag">já conquistado por ${esc(pio)}</span>` : ''}</p>` : ''}
      ${c.primeiraVisita ? `<p><b>Primeira visita:</b> ${esc(c.primeiraVisita)}</p>` : ''}
      ${venc.length ? `<p class="mut">Já vencido por: ${venc.map(esc).join(', ')}</p>` : ''}
      ${pl ? `<div class="result">Com o seu melhor time agora (${pl.pk.map(id => esc(E.P(id).nome)).join(' + ')}), a chance estimada de vitória é de <b>${Math.round(pl.p * 100)}%</b>.</div>` : ''}
      <div class="mfoot"><button id="todos">Ver todos os líderes</button><button class="pri" data-x>Fechar</button></div></div></div>`);
    $('#todos').onclick = modalLideres;
  }
  function modalLideres() {
    const p = E.J(st), g = E.grafo(st);
    const lista = Object.entries(st.lideres).map(([k, lid]) => ({ k, L: E.idx().ld[lid], c: g.nodes[k].cidade })).sort((a, b) => a.L.insignias.localeCompare(b.L.insignias) || a.L.forca - b.L.forca);
    abrirModal(`<h2>Líderes em jogo</h2><p class="mut">Clique num líder para ver os detalhes. ✓ = já vencido por ${esc(p.nome)}.</p>
      ${['1-2', '3-4', '5-6'].map(f => `<h3 style="margin-top:14px">Insígnias ${f}</h3><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">${lista.filter(x => x.L.insignias === f).map(x => `<div class="pc ${p.lideresVencidos.includes(x.L.id) ? 'off' : ''}" data-k="${x.k}" title="${esc(x.c.nome)}"><img src="${x.L.img}"><span class="f">${esc(x.c.nome)}${p.lideresVencidos.includes(x.L.id) ? ' ✓' : ''}</span></div>`).join('')}</div>`).join('')}
      ${st.lideresFora.length ? `<p class="mut" style="margin-top:14px">Fora do tabuleiro (Ginásio Alternativo): ${st.lideresFora.map(id => esc(E.idx().ld[id].nome) + ' (' + E.idx().ld[id].insignias + ')').join(', ')}</p>` : ''}
      <div class="mfoot"><button class="pri" data-x>Fechar</button></div>`);
    $('#modalCard').querySelectorAll('[data-k]').forEach(c => c.onclick = () => modalLiderInfo(c.dataset.k));
  }

  // ---------- IA ----------
  let timerIA = null, pausado = false, esperandoHumano = false;
  function agendarIA() {
    if (timerIA || !st || pausado || !souAnfitriao()) return;
    if (anim) { setTimeout(agendarIA, 250); return; }
    const p = E.J(st); if (!p.ia || !window.AI) { esperandoHumano = false; return; }
    if (!$('#modal').hidden && !$('#modalCard').dataset.pend) return; // um humano está usando outra janela
    if (!$('#parqueFx').hidden) { setTimeout(agendarIA, 600); return; }
    if (rolTimer || animDu.timer || animLd.timer) { setTimeout(agendarIA, 400); return; }
    if (boardMode || animCap.timer) { if (animCap.timer) setTimeout(agendarIA, 850); return; }
    timerIA = setTimeout(() => {
      timerIA = null; if (!st || pausado) return;
      if (!$('#modal').hidden && !$('#modalCard').dataset.pend) { setTimeout(agendarIA, 600); return; }
      const r = window.AI.passo(st);
      if (r === 'esperar') { if (!esperandoHumano) { esperandoHumano = true; render(); } return; }
      esperandoHumano = false;
      if (r) { E.posAcao(st); salvar(); render(); if (NET.modo === 'host' && NET.difundir) NET.difundir(); const q = E.J(st); if (!q.ia) setTimeout(() => focar(q.pos, 0.55), 20); }
      else if (st.fila && st.fila.length && !st.pend) { st.fila = []; render(); }
    }, VEL[prefs.velIA] || 750);
  }
  setInterval(() => { if (st && E.J(st).ia && !esperandoHumano) agendarIA(); }, 1500);

  // ---------- caixa de ferramentas ----------
  function selJog(id, def) { return `<select id="${id}">${st.jogadores.map(q => `<option value="${q.id}" ${q.id === def ? 'selected' : ''}>${esc(q.nome)}</option>`).join('')}</select>`; }
  const COR_OPS = ['rosa', 'verde', 'azul', 'vermelho', 'amarelo'].map(c => `<option>${c}</option>`).join('');
  function caixaFerramentas() {
    const voltar = st.pend;
    abrirModal(`<h2>Caixa de ferramentas</h2><p class="mut">Para aplicar à mão os efeitos de Eventos, cidades e itens que o protótipo ainda não automatiza.</p>
      <div class="row" style="margin-bottom:12px"><span>Aplicar em:</span>${selJog('tj', st.vez)}</div>
      <div class="toolgrid">
        <fieldset><legend>Cartas</legend><button data-t="item">Comprar 1 Item</button><button data-t="treinador">Comprar 1 Treinador</button><button data-t="evento">Comprar Evento</button><button data-t="superevento">Comprar Super Evento</button></fieldset>
        <fieldset><legend>Pokémon fora do jogo</legend><select id="tcor">${COR_OPS}</select><button data-t="ganhar">Ganhar aleatório desta cor</button><button data-t="capturar">Tentar capturar desta cor</button></fieldset>
        <fieldset><legend>Pokémon no tabuleiro</legend><button data-t="revelar">Revelar uma carta…</button><button data-t="capturarSlot">Tentar capturar uma carta…</button><button data-t="pegarSlot">Pegar uma carta de graça…</button></fieldset>
        <fieldset><legend>Turnos e posição</legend><button data-t="pular">Perder o próximo turno</button><button data-t="mover">Mover peão para…</button><button data-t="moverAtivar">Mover e ativar espaço…</button></fieldset>
        <fieldset><legend>Entre jogadores</legend>${selJog('tcom', (st.vez + 1) % st.jogadores.length)}<button data-t="trocar">Trocar Pokémon…</button><button data-t="roubar">Pegar Item aleatório dele</button><button data-t="trocarTr">Trocar Treinadores</button><button data-t="duelo">⚔ Batalha entre jogadores</button></fieldset>
        <fieldset><legend>Ajustes</legend><button data-t="descartarItem">Descartar Item…</button><button data-t="darItem">Dar Item ao outro jogador…</button><button data-t="removerPokemon">Devolver Pokémon…</button><button data-t="mais1">Marcador +1 num Pokémon…</button></fieldset>
      </div>
      <div class="mfoot"><button class="pri" id="tfim">${voltar ? 'Voltar' : 'Fechar'}</button></div>`);
    const jg = () => +$('#tj').value, com = () => +$('#tcom').value;
    const feito = () => { salvar(); render(); if (!st.pend || st.pend === voltar) { if (voltar) renderPend(); else caixaFerramentas(); } };
    $('#tfim').onclick = () => { fecharModal(); render(); };
    $('#modalCard').querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const t = b.dataset.t, a = { jogador: jg() };
      const viaTabuleiro = (tipo, msg, cb) => { fecharModal(); boardMode = { tipo, msg, cb: k => { cb(k); salvar(); render(); } }; render(); };
      if (['item', 'treinador', 'evento', 'superevento', 'pular'].includes(t)) { E.ferramenta(st, t, a); return feito(); }
      if (t === 'ganhar' || t === 'capturar') { a.cor = $('#tcor').value; E.ferramenta(st, t, a); return feito(); }
      if (t === 'revelar' || t === 'capturarSlot' || t === 'pegarSlot') return viaTabuleiro('slot', 'Clique numa carta de Pokémon no tabuleiro', k => E.ferramenta(st, t, Object.assign(a, { slot: k })));
      if (t === 'mover' || t === 'moverAtivar') return viaTabuleiro('espaco', 'Clique no espaço de destino', k => E.ferramenta(st, 'mover', Object.assign(a, { espaco: k, ativar: t === 'moverAtivar' })));
      if (t === 'roubar') { E.ferramenta(st, 'roubarItem', Object.assign(a, { de: com() })); return feito(); }
      if (t === 'trocarTr') { E.ferramenta(st, 'trocarTreinadores', Object.assign(a, { com: com() })); return feito(); }
      if (t === 'duelo') return modalDuelo(st.pend && st.pend.tipo === 'carta' ? ((st.pend.baralho === 'evento' ? E.idx().ev : E.idx().sev)[st.pend.carta].duelo) : null, jg(), com());
      if (t === 'trocar') return escolherCartas('Troca: escolha o seu Pokémon e o do outro jogador', [[jg(), 'pokemon'], [com(), 'pokemon']], ([m, d]) => { E.ferramenta(st, 'trocar', { jogador: jg(), com: com(), meu: m, dele: d }); feito(); });
      if (t === 'descartarItem') return escolherCartas('Qual Item descartar?', [[jg(), 'itens']], ([i]) => { E.ferramenta(st, 'descartarItem', Object.assign(a, { inst: i })); feito(); });
      if (t === 'darItem') return escolherCartas('Qual Item dar?', [[jg(), 'itens']], ([i]) => { E.ferramenta(st, 'darItem', Object.assign(a, { inst: i, para: com() })); feito(); });
      if (t === 'removerPokemon') return escolherCartas('Qual Pokémon devolver para fora do jogo?', [[jg(), 'pokemon']], ([i]) => { E.ferramenta(st, 'removerPokemon', Object.assign(a, { id: i })); feito(); });
      if (t === 'mais1') return escolherCartas('Qual Pokémon recebe +1 permanente?', [[jg(), 'pokemon']], ([i]) => { E.ferramenta(st, 'mais1', Object.assign(a, { id: i })); feito(); });
    });
  }
  function escolherCartas(titulo, grupos, cb) {
    const esc2 = grupos.map(() => null);
    const draw = () => {
      abrirModal(`<h2>${esc(titulo)}</h2>${grupos.map(([pi, campo], gi) => { const q = E.J(st, pi); return `<h3 style="margin-top:12px">${esc(q.nome)}</h3><div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">${q[campo].map(id => `<div class="pc ${esc2[gi] === id ? 'sel' : ''}" data-g="${gi}" data-id="${id}"><img src="${campo === 'itens' ? E.ITEM(id).img : E.P(id).img}"></div>`).join('') || '<span class="mut">Nada.</span>'}</div>`; }).join('')}
        <div class="mfoot"><button id="cv">Voltar</button><button class="pri" id="cok" ${esc2.every(Boolean) ? '' : 'disabled'}>Confirmar</button></div>`);
      $('#modalCard').querySelectorAll('.pc').forEach(c => c.onclick = () => { esc2[+c.dataset.g] = c.dataset.id; draw(); });
      $('#cv').onclick = caixaFerramentas; $('#cok').onclick = () => cb(esc2);
    };
    draw();
  }
  function modalDuelo(mods, a0, b0) {
    const S = { a: { jogador: a0 != null ? a0 : st.vez, pokemon: null, item: null }, b: { jogador: b0 != null ? b0 : (st.vez + 1) % st.jogadores.length, pokemon: null, item: null }, r: null };
    const lado = (k) => { const s = S[k], q = E.J(st, s.jogador); const ap = q.pokemon.filter(id => E.obedece(q, E.P(id).cor)); const its = q.itens.filter(i => E.ITEM(i).uso === 'batalha' && E.ITEM(i).bonus);
      return `<div><div class="row" style="margin-bottom:8px">${`<select data-j="${k}">${st.jogadores.map(x => `<option value="${x.id}" ${x.id === s.jogador ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select>`}</div>
        <div class="pick" style="grid-template-columns:repeat(auto-fill,minmax(70px,1fr))">${ap.map(id => `<div class="pc ${s.pokemon === id ? 'sel' : ''}" data-k="${k}" data-id="${id}"><img src="${E.P(id).img}"><span class="f">${E.forcaBase(q, id) + E.bonusTreinador(q, id)}</span></div>`).join('')}</div>
        <select data-i="${k}" style="margin-top:8px;width:100%"><option value="">— sem item —</option>${its.map(i => `<option value="${i}" ${s.item === i ? 'selected' : ''}>${esc(E.ITEM(i).nome)} (+${E.ITEM(i).bonus})</option>`).join('')}</select></div>`; };
    const draw = () => {
      abrirModal(`<h2>⚔ Batalha entre jogadores</h2><p class="mut">Cada jogador escolhe seu Pokémon (para esconder a escolha, passe o dispositivo). ${mods ? `Local do duelo — +1: ${mods.mais1.map(t => E.TIPOS_NOME[t]).join(', ')} · −1: ${mods.menos1.map(t => E.TIPOS_NOME[t]).join(', ')}.` : ''}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">${lado('a')}${lado('b')}</div>
        ${S.r ? `<div class="result ok"><b class="big">${S.r.venc == null ? 'Empate — ambos desmaiam' : esc(E.J(st, S.r.venc).nome) + ' vence!'}</b>${esc(E.J(st, S.a.jogador).nome)}: ${S.r.fa} (dado ${S.r.da}) × ${S.r.fb} (dado ${S.r.db}) ${esc(E.J(st, S.b.jogador).nome)}</div>` : ''}
        <div class="mfoot"><button id="dv">Voltar</button>${S.r ? '<button id="dn">Nova batalha</button>' : `<button class="pri" id="dg" ${S.a.pokemon && S.b.pokemon ? '' : 'disabled'}>🎲 Batalhar</button>`}</div>`);
      $('#modalCard').querySelectorAll('[data-j]').forEach(s => s.onchange = () => { S[s.dataset.j] = { jogador: +s.value, pokemon: null, item: null }; draw(); });
      $('#modalCard').querySelectorAll('[data-k]').forEach(c => c.onclick = () => { if (S.r) return; S[c.dataset.k].pokemon = c.dataset.id; draw(); });
      $('#modalCard').querySelectorAll('[data-i]').forEach(s => s.onchange = () => { S[s.dataset.i].item = s.value || null; });
      $('#dv').onclick = () => { fecharModal(); render(); };
      const g = $('#dg'); if (g) g.onclick = () => { S.r = E.duelo(st, S.a, S.b, mods); salvar(); render(); draw(); };
      const nn = $('#dn'); if (nn) nn.onclick = () => { S.r = null; S.a.pokemon = S.b.pokemon = S.a.item = S.b.item = null; draw(); };
    };
    draw();
  }

  // ---------- modo on-line (PeerJS): o anfitrião roda o motor; os outros mandam ações e recebem o estado filtrado ----------
  const PREFIXO = 'pmthex-', ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const novoCodigo = () => Array.from({ length: 5 }, () => ALFA[Math.floor(Math.random() * ALFA.length)]).join('');
  function tokenLocal() { let t = null; try { t = localStorage.getItem('pmthex-token'); } catch (e) {} if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem('pmthex-token', t); } catch (e) {} } return t; }
  function opcoesPeer() { const q = new URLSearchParams(location.search).get('peer'); if (!q) return { debug: 1 }; const [host, port] = q.split(':'); return { host, port: +port || 9000, path: '/', secure: false, debug: 1 }; }
  function linkSala(c) { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('sala', c); const pq = new URLSearchParams(location.search).get('peer'); if (pq) u.searchParams.set('peer', pq); return u.toString(); }
  function avisoRede(msg) { let b = $('#netBar'); if (!b) { b = h('<div id="netBar"></div>'); document.body.appendChild(b); } b.textContent = msg || ''; b.hidden = !msg; }
  function toast(msg) { const t = h(`<div class="toast">${msg}</div>`); document.body.appendChild(t); setTimeout(() => t.classList.add('fora'), 2200); setTimeout(() => t.remove(), 2800); }
  function semPeer() { if (window.Peer) return false; alert('Não consegui carregar a biblioteca de conexão (PeerJS). Verifique a internet e recarregue a página.'); return true; }
  const H = { peer: null, conns: new Map(), lobby: null, timer: null, redesenhar: null };
  function abrirSala(codigo, aoAbrir) {
    NET.modo = 'host'; NET.codigo = codigo;
    const peer = H.peer = new Peer(PREFIXO + codigo, opcoesPeer());
    peer.on('open', () => { avisoRede(null); if (aoAbrir) { const f = aoAbrir; aoAbrir = null; f(); } });
    peer.on('error', e => {
      if (e.type === 'unavailable-id') { avisoRede('O código da sala ainda está reservado; tentando de novo…'); try { peer.destroy(); } catch (x) {} setTimeout(() => abrirSala(codigo, aoAbrir), 3000); }
      else if (e.type !== 'peer-unavailable') avisoRede('Conexão: ' + (e.type || e));
    });
    peer.on('disconnected', () => { avisoRede('Reconectando ao servidor de salas…'); setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (x) {} }, 1500); });
    peer.on('connection', conn => {
      conn.on('data', m => hostRecebe(conn, m));
      conn.on('close', () => { H.conns.delete(conn.peer); atualizarConexoes(); });
      conn.on('error', () => {});
    });
  }
  function hostRecebe(conn, m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'oi') {
      let assento = -1; const tok = String(m.token || '');
      if (st) { const q = st.jogadores.find(x => x.token && x.token === tok); if (q) assento = q.id; }
      else if (H.lobby) {
        const L = H.lobby.jog; let k = L.findIndex(x => x.tipo === 'remoto' && x.token === tok); if (k < 0) k = L.findIndex(x => x.tipo === 'remoto' && !x.token);
        if (k >= 0) { L[k].token = tok; L[k].nome = String(m.nome || '').trim().slice(0, 20) || 'Jogador ' + (k + 1); assento = k; }
      }
      H.conns.set(conn.peer, { conn, token: tok, assento });
      if (st) { atualizarConexoes(); enviarEstado(H.conns.get(conn.peer)); if (assento >= 0) toast(`🌐 ${esc(E.J(st, assento).nome)} conectou`); }
      else { difundirLobby(); if (H.redesenhar) H.redesenhar(); }
      return;
    }
    if (m.t === 'cor') {
      const c = H.conns.get(conn.peer); if (!H.lobby || !c || c.assento < 0) return;
      if (trocarCorLobby(c.assento, m.cor)) { difundirLobby(); if (H.redesenhar) H.redesenhar(); }
      return;
    }
    if (m.t === 'acao') {
      const c = H.conns.get(conn.peer); if (!c || !st || c.assento < 0 || typeof m.nome !== 'string') return;
      if (E.acao(st, c.assento, m.nome, ...(Array.isArray(m.args) ? m.args : []))) { salvar(); render(); NET.difundir(); }
      else try { conn.send({ t: 'recusado', nome: m.nome }); } catch (e) {}
    }
  }
  function conectadosIds() { const ids = new Set(); H.conns.forEach(c => { if (c.assento >= 0) ids.add(c.assento); }); if (NET.eu != null) ids.add(NET.eu); return [...ids]; }
  function enviarEstado(c) { try { c.conn.send({ t: 'estado', v: E.vistaDe(st, c.assento), eu: c.assento, conectados: conectadosIds(), codigo: NET.codigo }); } catch (e) {} }
  NET.difundir = () => { if (NET.modo !== 'host') return; clearTimeout(H.timer); H.timer = setTimeout(() => H.conns.forEach(enviarEstado), 25); };
  function atualizarConexoes() { NET.conectados = conectadosIds(); if (st) { render(); NET.difundir(); } else { difundirLobby(); if (H.redesenhar) H.redesenhar(); } }
  function difundirLobby() {
    const L = H.lobby; if (!L) return; const con = new Set([...H.conns.values()].map(c => c.assento));
    H.conns.forEach(c => { try { c.conn.send({ t: 'lobby', codigo: L.codigo, jog: L.jog.map((x, k) => ({ nome: x.nome, cor: x.cor, tipo: x.tipo, ocupado: !!x.token, conectado: x.tipo === 'eu' || con.has(k) })), voce: c.assento }); } catch (e) {} });
  }
  // troca de cor na sala de espera: só para uma cor que ninguém está usando
  function trocarCorLobby(k, cor) { const L = H.lobby && H.lobby.jog; if (!L || !L[k] || !E.CORES_PEAO.includes(cor) || L.some((x, i) => i !== k && x.cor === cor)) return false; L[k].cor = cor; return true; }
  const swatchesLobby = (jog, k) => `<div class="swatches">${E.CORES_PEAO.map(c => { const usada = jog.some((x, i) => i !== k && x.cor === c); return `<span class="sw ${c === jog[k].cor ? 'on' : ''} ${usada ? 'taken' : ''}" data-cor="${c}" title="${COR_NOME[c]}${usada ? ' (em uso)' : ''}" style="background:${COR_HEX[c]}"></span>`; }).join('')}</div>`;
  function criarSala(jog, seed) {
    if (semPeer()) return;
    const codigo = novoCodigo(); H.lobby = { codigo, jog, seed };
    telaSalaHost();
    abrirSala(codigo, () => telaSalaHost());
  }
  function telaSalaHost() {
    const L = H.lobby, box = $('#setup'), link = linkSala(L.codigo), con = new Set([...H.conns.values()].map(c => c.assento));
    const faltam = L.jog.filter(x => x.tipo === 'remoto' && !x.token).length;
    box.innerHTML = `<div class="setupCard"><div class="logo"><h1>Sala on-line <b>${esc(L.codigo)}</b></h1><span class="tag">${H.peer && H.peer.open ? '🟢 aberta' : '⏳ abrindo…'}</span></div>
      <p>Mande este link para os amigos:</p>
      <div class="row" style="flex-wrap:nowrap"><input id="lk" value="${esc(link)}" readonly style="flex:1"><button id="cp">📋 Copiar</button></div>
      <h3 style="margin-top:18px">Lugares</h3>
      <div class="salaLista">${L.jog.map((x, k) => `<div class="salaRow"><span class="dot" style="background:${COR_HEX[x.cor]}"></span><b style="flex:1">${esc(x.nome || (x.tipo === 'ia' ? 'CPU ' + (k + 1) : '—'))}</b>
        ${x.tipo === 'eu' ? swatchesLobby(L.jog, k) : ''}<span class="mut">${x.tipo === 'eu' ? 'você · anfitrião' : x.tipo === 'ia' ? '🤖 IA' : x.token ? (con.has(k) ? '🌐 conectado' : '🔌 saiu') : '⏳ aguardando alguém entrar'}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:14px"><button id="cancel">Cancelar</button><span style="flex:1"></span><button class="pri" id="start">${faltam ? `Começar (${faltam} lugar${faltam > 1 ? 'es' : ''} vazio${faltam > 1 ? 's' : ''} vira${faltam > 1 ? 'm' : ''} IA)` : 'Começar partida'}</button></div></div>`;
    box.querySelectorAll('[data-cor]').forEach(sw => sw.onclick = () => { const k = L.jog.findIndex(x => x.tipo === 'eu'); if (trocarCorLobby(k, sw.dataset.cor)) { difundirLobby(); telaSalaHost(); } });
    $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(link); $('#cp').textContent = '✔ Copiado'; } catch (e) { $('#lk').select(); } };
    $('#cancel').onclick = () => { try { H.peer.destroy(); } catch (e) {} H.lobby = null; NET.modo = 'local'; telaAbertura(); };
    $('#start').onclick = () => comecarOnline();
    H.redesenhar = telaSalaHost;
  }
  function comecarOnline() {
    const L = H.lobby; H.redesenhar = null;
    L.jog.forEach((x, k) => { if (x.tipo === 'remoto' && !x.token) { x.tipo = 'ia'; x.nome = 'CPU ' + (k + 1); } });
    st = E.novoJogo({ seed: L.seed, jogadores: L.jog.map((x, k) => ({ nome: (x.nome || '').trim() || (x.tipo === 'ia' ? 'CPU ' + (k + 1) : 'Jogador ' + (k + 1)), cor: x.cor, ia: x.tipo === 'ia' })) });
    st.jogadores.forEach((q, k) => { if (L.jog[k].tipo === 'remoto') { q.remoto = true; q.token = L.jog[k].token; } });
    NET.eu = 0; st.online = { codigo: L.codigo, eu: 0 }; H.lobby = null;
    salvar(); iniciarJogo(); atualizarConexoes();
  }
  function retomarSala(salvo) {
    if (semPeer()) return;
    st = salvo; NET.eu = salvo.online.eu; iniciarJogo(); avisoRede('Reabrindo a sala…');
    abrirSala(salvo.online.codigo, () => { avisoRede(null); toast('🌐 Sala reaberta: os jogadores podem voltar pelo mesmo link.'); });
  }
  // --- quem entra pelo link
  const C = { peer: null, conn: null, codigo: null, nome: '', ligando: false, lobby: null };
  function telaEntrar(codigo) {
    const box = $('#setup'); $('#game').hidden = true; box.hidden = false;
    box.innerHTML = `<div class="setupCard"><div class="logo"><h1>Entrar na sala <b>${esc(codigo)}</b></h1><span class="tag">Pokémon Master Trainer: HEX</span></div>
      <p class="mut">Você foi convidado para uma partida on-line. Escolha seu nome e entre.</p>
      <div class="row" style="flex-wrap:nowrap"><input id="nm" placeholder="Seu nome" value="${esc(prefs.nome || '')}" style="flex:1" maxlength="20"><button class="pri" id="ent">Entrar</button></div>
      <p class="mut" id="est" style="margin-top:10px"></p><p class="mut" style="font-size:12px;margin-top:16px"><a href="${location.pathname}">Ou jogar no modo local</a></p></div>`;
    const ir = () => { const nome = $('#nm').value.trim() || 'Jogador'; prefs.nome = nome; salvarPrefs(); if (semPeer()) return; $('#est').textContent = '⏳ Conectando…'; $('#ent').disabled = true; entrarSala(codigo, nome); };
    $('#ent').onclick = ir; $('#nm').onkeydown = e => { if (e.key === 'Enter') ir(); };
  }
  function entrarSala(codigo, nome) {
    NET.modo = 'cliente'; C.codigo = codigo; C.nome = nome;
    const peer = C.peer = C.peer || new Peer(opcoesPeer());
    const ligar = () => {
      if (C.ligando) return; C.ligando = true;
      const conn = C.conn = peer.connect(PREFIXO + codigo, { reliable: true });
      conn.on('open', () => { C.ligando = false; conn.send({ t: 'oi', token: tokenLocal(), nome }); avisoRede(null); });
      conn.on('data', clienteRecebe);
      conn.on('close', () => { C.ligando = false; avisoRede('Conexão perdida com o anfitrião — tentando reconectar…'); setTimeout(ligar, 3000); });
      conn.on('error', () => { C.ligando = false; });
      setTimeout(() => { if (C.ligando && !conn.open) { C.ligando = false; try { conn.close(); } catch (e) {} ligar(); } }, 8000);
    };
    if (peer.open) ligar(); else peer.on('open', ligar);
    peer.on('error', e => { if (e.type === 'peer-unavailable') { C.ligando = false; avisoRede('Sala não encontrada — o anfitrião precisa estar com o jogo aberto. Tentando de novo…'); setTimeout(ligar, 4000); } else avisoRede('Conexão: ' + (e.type || e)); });
    peer.on('disconnected', () => { setTimeout(() => { try { if (!peer.destroyed) peer.reconnect(); } catch (x) {} }, 1500); });
    NET.enviar = (n, args) => { if (C.conn && C.conn.open) C.conn.send({ t: 'acao', nome: n, args }); else toast('Sem conexão com o anfitrião.'); };
  }
  function clienteRecebe(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'lobby') { C.lobby = m; NET.eu = m.voce; if (!st) telaSalaCliente(); return; }
    if (m.t === 'estado') {
      const antes = st, novoLayout = !antes || JSON.stringify(antes.layout) !== JSON.stringify(m.v.layout);
      st = m.v; NET.eu = m.eu; NET.conectados = m.conectados || [];
      if ($('#game').hidden) { iniciarJogo(); return; }
      if (novoLayout) desenharHexes();
      render();
    }
  }
  function telaSalaCliente() {
    const L = C.lobby, box = $('#setup');
    box.innerHTML = `<div class="setupCard"><div class="logo"><h1>Sala <b>${esc(L.codigo)}</b></h1><span class="tag">🟢 conectado</span></div>
      <p>${L.voce >= 0 ? 'Você está na sala. Aguardando o anfitrião começar a partida…' : 'A sala está cheia: você vai <b>assistir</b> à partida.'}</p>${L.voce >= 0 ? '<p class="mut">Clique numa cor livre para trocar a sua.</p>' : ''}
      <div class="salaLista">${L.jog.map((x, k) => `<div class="salaRow"><span class="dot" style="background:${COR_HEX[x.cor]}"></span><b style="flex:1">${esc(x.nome || '—')}${k === L.voce ? ' <span class="tag">você</span>' : ''}</b>
        ${k === L.voce ? swatchesLobby(L.jog, k) : ''}<span class="mut">${x.tipo === 'eu' ? 'anfitrião' : x.tipo === 'ia' ? '🤖 IA' : x.ocupado ? (x.conectado ? '🌐 conectado' : '🔌 saiu') : '⏳ lugar livre'}</span></div>`).join('')}</div></div>`;
    box.querySelectorAll('[data-cor]').forEach(sw => sw.onclick = () => { if (sw.classList.contains('taken') || !C.conn || !C.conn.open) return; C.conn.send({ t: 'cor', cor: sw.dataset.cor }); });
  }

  // ---------- menu da partida ----------
  $('#logMax').onclick = () => { if (st) modalLog(); };
  // celular: altura da barra de baixo (turno + abas) para o tabuleiro não ficar escondido atrás dela
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { const h = $('#turnBox').offsetHeight + $('#mTabs').offsetHeight; document.documentElement.style.setProperty('--barra', h + 'px'); }); ro.observe($('#turnBox')); ro.observe($('#mTabs')); }
  // celular: abas que abrem uma gaveta com uma seção do painel por vez
  $('#mTabs').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    const t = b.dataset.tab, sd = $('#side'); if (t === 'cfg') { if (st) modalConfig(); return; }
    const ja = sd.dataset.gaveta === t; sd.dataset.gaveta = ja ? '' : t;
    $('#mTabs').querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', !ja && x.dataset.tab === t));
    if (!ja && t === 'registro') { const lg = $('#log'); lg.scrollTop = lg.scrollHeight; }
  });
  // telas de toque: tocar numa insígnia mostra o Líder e o prêmio
  document.addEventListener('click', e => { const bd = e.target.closest('.badge[title]'); if (bd && matchMedia('(hover: none)').matches) toast(esc(bd.title)); });
  if ((prefs.recolhidas || {}).log) $('#logBox').classList.add('fechada');
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#zoomCard').hidden = true; if (!$('#modal').hidden && !$('#modalCard').dataset.pend) fecharModal(); if (boardMode && !boardMode.pend) { boardMode = null; render(); } } });

  { const sala = new URLSearchParams(location.search).get('sala'); if (sala) telaEntrar(sala.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); else telaAbertura(); }
  window.__pmt = { get st() { return st; }, set st(v) { st = v; }, render, run: (f, ...a) => run(E[f], ...a), agir, NET };
})();
