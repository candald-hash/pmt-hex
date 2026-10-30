# Pokémon Master Trainer: HEX — versão web (protótipo)

## Como jogar agora

Abra `web/index.html` no Chrome ou no Edge, com dois cliques. Não precisa de servidor nem de instalação.

- É o **modo local**: de 2 a 6 jogadores no mesmo navegador, passando a vez.
- A partida é salva sozinha no navegador. Em **Partida ▾** dá para exportar ou importar um arquivo `.json` e continuar em outro computador.
- A **semente** na tela inicial repete o mesmo sorteio (tabuleiro, cartas e dados), o que ajuda a testar.

## Novidades desta versão

- Versão do jogo (v7.3) ao lado de "versão web"; links para a nova página de Changelog (changelog.html) e para a de Elencos na tela inicial.
- Nova tela inicial: fundo com o tabuleiro (escurecido/clareado conforme o tema), logo do jogo ao lado do título, textos enxutos e layout melhor no celular.
- Remédio: sprite da poção nos botões; ao usar (Ginásio ou Liga) aparece uma faixa verde para todos e, na Liga, um aviso na tela da batalha.
- Faixas de aviso (Truque Rocket, Bicicleta, Voar) crescem quando o texto quebra em duas linhas.
- Duelos e Festival de Praça: na escolha do oponente, o ícone 🔍 mostra os Pokémons de cada adversário (passe o mouse ou toque).
- Correção: travar um Pokémon sem evolução (ex.: Lendários, Lapras, Absol) agora dá o +1 e protege de trocas, como nas famílias.
- Correção: nas famílias ramificadas (Eevee, Slowpoke), evoluções "irmãs" (ex.: Vaporeon + Umbreon, Slowbro + Slowking) não dão mais bônus de evolução entre si; é preciso ter a pré-evolução (Eevee / Slowpoke). Os dois Eevees (rosa e verde) não dão bônus um ao outro.
- Repel: a tela seguinte (ex.: a captura) mostra no topo o Pokémon trocado e o Repel de quem usou.
- Truque Rocket: a faixa usa dois sprites de membros da Equipe Rocket, um de cada lado do texto.
- Prof. Birch (e outros Eventos de ranking): a tela de resultado mostra quem ganhou o prêmio e por quê (ex.: menos Itens em mão).
- Poké-Flauta: o novo Evento mostra no topo o Evento substituído e a Flauta de quem tocou.
- Exp. Share / May / Suborno Rocket: quem copia ganha a própria tela do Evento, com o aviso de que está copiando.
- Voar: animação do Pidgeot buscando o peão e largando-o no destino.
- Bicicleta: o ciclista da animação agora usa os sprites em pixel art (6 quadros de pedalada), na cor do jogador.
- Efeitos na tela: faixa animada de "Turno extra" com um ciclista atravessando a tela (Bicicleta) e faixa de "Truque Rocket" com a carta voando da vítima para o ladrão (vale também para Eventos que roubam Itens; só os dois envolvidos veem qual Item foi).
- Pokédex: a tela de conclusão mostra as cartas reveladas e seus hexágonos.
- Jogador preso (sem Pokémon para atravessar as passagens de tipo em volta, ex.: depois de Voar/Túnel): no início da vez dele, volta para a cidade do hexágono, descarta 1 Item aleatório e perde o turno, com aviso.
- Copycat: não troca os jogadores de lugar se algum deles estiver no hexágono do Planalto Índigo (os Itens são comprados normalmente).
- Pokédex (e outras revelações): a escolha é feita direto no tabuleiro.
- "Propor troca" saiu da barra de botões e foi para o perfil do jogador (clique no adversário na lista de Jogadores). Sugestões de troca: sempre até 3 (mesma linha 🔗, depois mais fortes 💪), com o ícone sob cada carta.
- Negociador e Criadores Pokémon: a tela de resultado mostra os Pokémons devolvidos para fora do jogo.
- Eventos de troca (Troca Pokémon, S.S. Anne): na escolha do oponente, cada um mostra até 3 Pokémons que você pode receber — da mesma linha evolutiva de algum seu ou, se não houver, os mais fortes.
- Elenco alternativo de Pokémons (225 cartas): escolha "Elenco de Pokémons" ao criar a partida (local) ou na sala on-line (o anfitrião escolhe). Página de conferência das cartas: elenco.html.
- Correção: o efeito de Pioneiro (ex.: Mahogany) se repetia a cada visita quando o pioneiro era o 1º jogador.
- Liga: o jogador eliminado devolve seus Pokémons às pilhas e descarta Itens e Treinador; eliminados não são mais afetados nem escolhidos por efeitos.
- Captura: chance de captura (%) sempre visível, atualizada com a Bola escolhida (cada Bola mostra a chance com ela); também na escolha entre cartas.
- On-line: as Bolas e Itens de batalha de outro jogador não aparecem mais para quem está só assistindo (inclusive o anfitrião).
- Sala on-line: com a sala já criada, o anfitrião pode adicionar lugares (pessoa ou IA), remover lugares e alternar cada lugar entre pessoa e IA. Quem perde o lugar passa a assistir e entra sozinho no próximo lugar aberto.
- Botões Rolar dado · Propor troca · Encerrar turno sempre lado a lado, no mesmo lugar (ações extras ficam numa linha abaixo).
- Poké-Fans e Esconderijo Rocket: a tela de resultado mostra os Treinadores trocados e os novos donos.
- Cassino (e outras tabelas de dado): o resultado de Itens aparecia como "itensEv"; agora mostra "N Cartas Item".
- Módulo de Lura: a escolha dos dois Pokémons é feita direto no tabuleiro (clique de novo no primeiro para desfazer).
- Correção: a IA travava ao escolher Pokémon na Liga quando havia revanche (mesmo confronto de novo) ou Remédio, na vez de um humano; também no Festival de Praça repetido.
- Eventos de troca (Troca Pokémon, S.S. Anne, Festival Pokémon): a tela de resultado mostra as cartas trocadas e os novos donos.
- Propostas de troca entre jogadores humanos: no seu turno, "🤝 Propor troca" (até 3 Pokémon de cada lado); o alvo aceita ou recusa no início da própria vez. Famílias travadas não entram; propostas que perderam a validade são anuladas.
- Tela do Mestre Pokémon: time agrupado por linha evolutiva, insígnias e estatísticas do campeão (batalhas vencidas/enfrentadas por tipo, Eventos e Super Eventos comprados, capturas).
- Mapa: caminho que faltava no hexágono de Eterna (B5) adicionado.
- **Escolha de Pokémon agrupada (Liga, Duelos, Ginásio e Festival de Praça):** as linhas evolutivas aparecem juntas na moldura com o bônus (evol. +2/+4, 🔒 travada), como na seção Time. Só aparecem os Pokémons que podem lutar; o número em cada carta continua sendo a força prevista. No Festival de Praça, a etiqueta conta só Rosas, Verdes e Iniciais, como a regra.

- **Peão animado:** ao escolher o destino, o peão desliza espaço por espaço pelo caminho, com um pulinho em cada espaço (no Trem, vai direto e mais devagar). As janelas que aparecem na chegada (captura, Evento…) esperam o peão chegar. No on-line, todos veem a animação das jogadas dos outros. Quem usa "reduzir movimento" no sistema vê o peão pular direto.
- **Destaque da vez:** o peão de quem joga ganha um anel amarelo pulsando.

- **Celular em pé:** o tabuleiro ocupa a tela inteira; embaixo fica uma barra fixa com o turno (de quem é a vez, dado e botões) e as abas 🎒 Ficha · 👥 Jogadores · 📜 Registro · ⚙. Cada aba abre uma gaveta por cima do tabuleiro; tocar de novo fecha. As janelas sobem da parte de baixo da tela. Computador e tablet continuam como antes (no tablet em pé o painel agora fica ao lado, mais estreito, em vez de embaixo); celular deitado usa o painel compacto ao lado.
- **Toque:** zoom com dois dedos e duplo toque para aproximar no tabuleiro; tocar numa insígnia mostra o Líder e o prêmio.
- **Pokémon enfraquecido:** borda vermelha em volta da carta e selo vermelho "±1" no canto (o marcador dá ±1 no dado de captura), no lugar da faixa que cobria a carta.

- **Seções recolhíveis:** clique no título de Time, Itens, Treinador, Jogadores ou Registro para recolher ou mostrar (▸/▾). A escolha fica lembrada neste navegador.
- **Aviso de vez (on-line):** quando chega a sua vez aparece "🎲 Sua vez!"; quando uma decisão sua está esperando no turno de outro (reação, Duelo, Liga…), aparece um aviso. Se você estiver em outra aba, o título da aba fica piscando até você voltar.
- **Atualizações aparecem sem cache:** cada publicação força o navegador a baixar os arquivos novos.

- **Painel lateral mais limpo:** os botões Líderes, Tema, Caixa de ferramentas e Partida saíram do rodapé e foram para **⚙ Configurações** (engrenagem ao lado da Rodada). Os convidados on-line veem só Líderes, Registro, Tema e "Sair da sala".
- **Registro ampliado:** o botão **⤢ ampliar** ao lado de "Registro" abre a partida inteira numa janela maior, com a rodada de cada linha e os nomes de cartas interativos.
- **Insígnias:** a seção saiu da ficha (elas continuam na lista de Jogadores, um pouco maiores). Passar o mouse mostra o Líder e o prêmio, ex.: "Brawly (Insígnia 1 — Pokémons Azuis obedecem)"; as ainda não conquistadas mostram só o prêmio.

- **Tela do Evento mais simples:** antes de ativar, só o botão **Ativar efeito**; depois, só **Concluir**. Saíram a Caixa de ferramentas e o "Abrir duelo" da janela (os Eventos são todos automáticos); a Caixa de ferramentas continua no rodapé, para o anfitrião.
- **Cores na sala de espera:** cada convidado (e o anfitrião) pode trocar a própria cor por uma que ninguém esteja usando, até a partida começar.

- **Modo on-line (primeira versão):** na tela inicial, escolha **🌐 On-line**. O primeiro lugar é o seu (anfitrião); os outros podem ser 🌐 jogadores on-line ou 🤖 IA. Clique em **Criar sala** e mande o link (`…/?sala=CÓDIGO`) para os amigos; quem abrir escolhe o nome e entra no lugar livre. Quando você clicar em **Começar**, lugares vazios viram IA.
  - O seu navegador roda as regras e as IAs; os outros mandam as ações e recebem a partida já filtrada: ninguém vê os Itens dos outros, a ordem dos baralhos, as cartas viradas do tabuleiro, quem tem item de reação nem as escolhas secretas (Duelo, Liga, Festival de Praça) antes da revelação.
  - Cada um vê a própria ficha e só tem botões nas próprias decisões; nas dos outros aparece "⏳ Aguardando…". As janelas de reação abrem direto para quem tem o item.
  - Caixa de ferramentas e menu da Partida ficam só com o anfitrião, que também pode passar o lugar de alguém para a IA (e devolver) pelo painel do jogador.
  - Quem cair ou recarregar a página volta ao mesmo lugar pelo mesmo link; 🔌 marca quem está desconectado. Se o anfitrião fechar o jogo, a partida pausa: ao reabrir, use **Retomar a sala** na tela inicial. Quem entrar com a mesa cheia assiste.

- **Preparação para o modo on-line (etapa 1):** todas as ações da tela agora passam por um despachante único do motor, que sabe quem pode decidir cada coisa (quem joga a vez, o lado de cada um num Duelo, na Liga ou no Festival de Praça, quem tem o item numa janela de reação, e a Caixa de ferramentas só para o anfitrião). No Duelo, cada lado agora confirma a própria escolha. Nada muda no modo local.

- **Festival de Praça com escolha secreta:** as duas duplas são escolhidas ao mesmo tempo; entre dois humanos, cada um abre as próprias opções sem o outro olhar, e nada aparece até as duas serem confirmadas. Quem joga a vez pode usar o **Pedido a Celebi** nos dados do Festival (o adversário pode bloquear com Poké-Boneca).
- **Pilhas vazias no hexágono final:** "Compre os N próximos Pokémons Vermelhos/Azuis/Verdes (ou mais fracos)" agora completa com a cor mais fraca quando a pilha acaba (Vermelho → Azul → Verde → Rosa), e o registro avisa.
- **Bola GS:** o Pokémon com o marcador +1 permanente ganha borda dourada e a etiqueta "GS +1". O marcador acompanha o Pokémon nas trocas e some se ele voltar para a pilha. (A carta Bola GS já era removida do jogo depois do uso.)

- **Repel automático:** toda vez que um Pokémon é revelado no tabuleiro (ao parar no espaço, Mapa Regional, Máquina do Bill, Tempestade Pesada, Pioneiros etc.) e alguém tem Repel, abre a janela "⏳ Aguardando reações…" de 5 s — inclusive no turno dos outros. Quem tem o item escolhe qual Pokémon trocar, "Não usar" ou "Não usar até o meu próximo turno" (para não ser perguntado a cada revelação). O Pokémon volta para a pilha da cor e outro aleatório da mesma cor, fora do jogo, entra revelado no lugar (sem marcador de enfraquecido); a carta nova também pode ser "repelida" por outro jogador. Se havia uma captura em andamento, ela continua com o novo Pokémon. A IA usa o Repel para trocar um Pokémon que não lhe serve ou para tirar um Pokémon valioso do caminho de um adversário.

- **Remédio e Pedido a Celebi na Liga:** depois de cada duelo, quem luta pode usar o **Pedido a Celebi** para refazer o próprio dado ou o do adversário (que pode bloquear com Poké-Boneca); o resultado do duelo é recalculado. Quem teve o Pokémon nocauteado pode usar o **Remédio**: o Pokémon volta e o duelo é refeito com os mesmos dois Pokémons (os Itens de batalha podem ser escolhidos de novo). A IA também usa os dois.
- **Cynthia automática:** quando alguém falha numa captura, quem tem a Cynthia e está no mesmo hexágono (na ordem da mesa) pode tentar capturar aquele Pokémon antes de ele ficar enfraquecido, usando as próprias Bolas. Se também falhar, o Pokémon fica enfraquecido normalmente.

- **Festival de Praça automático:** quem ativa escolhe o oponente; o desafiado monta a dupla primeiro (às claras) e o desafiante responde. Só valem Pokémons Rosas, Verdes e Iniciais, e Azuis ou mais fortes não contam nem para o bônus de evolução. Cada dupla soma as forças (com Treinador, vantagem de tipo contra a dupla rival e até 1 Item de batalha por Pokémon) e rola um dado; empate, rolam de novo. O vencedor escolhe entre 3 Itens, 1 Evento, 1 Pokémon Azul, 2 Verdes ou 3 Rosas. Com isso, **todos os Eventos e Super Eventos são automáticos**.
- **Time agrupado por linha evolutiva:** Pokémons da mesma família ficam juntos dentro de uma moldura, com uma etiqueta do bônus de evolução (evol. +2 / +4); família travada aparece com moldura dourada e 🔒. Vale também na ficha dos outros jogadores.

- **Liga Pokémon automática (formato Mata-Mata, de 2 a 6 jogadores):**
  - Quando a Liga começa, todos vão para o Planalto Índigo; quem não tem 6 insígnias entra sem os benefícios das que faltam.
  - **6 jogadores:** o pioneiro do Planalto e quem tem mais capturas vão direto às semifinais; os outros 4 se enfrentam em confrontos sorteados.
  - **5 jogadores:** quem tem mais capturas vai direto; o pioneiro escolhe o oponente, os outros dois se enfrentam e os perdedores disputam a repescagem.
  - **Semifinais (6 e 5):** quem parar em "Começar a Liga" escolhe o oponente. **4 jogadores:** as semifinais acontecem na hora, e quem tem mais capturas escolhe.
  - **Final:** os finalistas voltam ao Planalto, jogam 3 turnos cada e depois se enfrentam.
  - **3 jogadores:** quem para em "Começar a Liga" enfrenta um oponente sorteado (ou o que ainda não venceu); vence quem derrotar os dois. **2 jogadores:** o primeiro com 2 vitórias.
  - Empate em capturas: desempate pela soma das forças e depois sorteio. Com a Liga em andamento, parar em "Começar a Liga" dispara a próxima fase sem exigir outra volta. Eliminados saem do jogo.
  - **Batalha 3×3:** tela própria com o placar dos Pokémons derrotados (✖), o Pokémon em campo e o histórico dos duelos. As escolhas são secretas: entre dois humanos, cada um abre as próprias opções sem o outro olhar. O vencedor do duelo continua em campo e só quem perdeu escolhe o próximo, já vendo o adversário. Empate: os dois desmaiam; se os 3 de cada lado caírem juntos, há duelo extra com um 4º Pokémon. Cada lado pode usar 1 Item de batalha por duelo.
  - Quem vence uma batalha compra 3 Itens (com Wally, pode trocar um). O campeão ganha a tela de Mestre Pokémon e o jogo termina.
  - O botão **Chaveamento** no painel do turno mostra a fase atual, o placar e todas as batalhas com seus duelos. A IA escolhe oponentes e Pokémons.
- **Correção:** os espaços "Compre os N próximos Pokémons" travavam quando a pilha daquela cor estava vazia.

- **Eventos com alvo automatizados (grupo 1):**
  - Prof. Impostor, Poké-Fans, Esconderijo Rocket, Troca Pokémon (Evento e Super Evento), S.S. Anne, Copycat (as 2 versões), DJ Mary, Operação Rocket e os 4 Duelos (com bônus do local, empates e prêmio).
  - O jogo pergunta quem é o alvo, a IA escolhe sozinha e a **Poké-Boneca** funciona nesses Eventos, inclusive Boneca contra Boneca.
  - Baralhos: Itens, Eventos, Super Eventos e Treinadores descartados voltam embaralhados quando o baralho acaba.

- **Grupo 2 automatizado:**
  - Invasões Aqua, Magma e Rocket: cada oponente pode se proteger com Poké-Boneca.
  - Colecionador e Centro de Criação: em caso de empate, quem ativou o Evento escolhe.
  - Também completei Prof. Birch, Prof. Carvalho, Sr. Fuji, Ruínas de Alph, Kurt e Operação Galactic.

- **Grupo 3 automatizado:** Presente de Delibird, Rota Bloqueada, Mapa Regional, Tempestade Pesada, Pokédex, Kimono Girl, Prof. Rowan, Negociador, Proposta de N, Novo Início, Túnel dos Diglett (escolha no tabuleiro), Bola GS, Ginásio Alternativo, Vendedor Viajante, Encontro Lendário, Expert em Fósseis, Máquina do Bill, Pesquisa de Oak, Previsão de Sabrina e Pokénav Melhorado.
- **Grupo 4 automatizado:** os efeitos com duração aparecem no painel do turno (⏳), com o dono e as rodadas restantes.
  - **Encrenca em Dobro:** os outros jogadores andam só 1 espaço por 2 rodadas.
  - **Parque Nacional:** conta as capturas por 3 rodadas, desempata pela soma das forças e premia os 3 primeiros.
  - **Suborno Rocket:** copia os Eventos dos oponentes até o seu próximo turno; se copiou algum, você perde esse turno.
  - **Barco de Briney:** dá um turno extra e, até o seu próximo turno, permite somar ou subtrair 1 do dado de quem estiver no seu hexágono.

- **Cidades:** todos os efeitos de Pioneiro e de Primeira visita agora são automáticos. Inclui Eventos para oponentes (Azalea, Laverre), distribuição de Eventos (Driftveil, Mistralton), trocas por cor (Vermilion, Viridian) e escolhas (Ecruteak, Olivine, Blackthorn).
- **Itens automatizados:** Módulo de Lura, Doce Raro, Pote de Mel, Truque Rocket (com Poké-Boneca), Vara de Pesca (o espaço atual e os vizinhos acendem) e Voar. A IA usa Doce Raro, Truque Rocket e Pote de Mel.
- **Animação do dado na captura:** cerca de 0,8 s rolando, depois o dado pousa com borda verde ou vermelha e o resultado aparece.
- **Batalhas de Ginásio com arena:** a conta detalhada de cada Pokémon (inclusive DUAL), a força fixa do Líder com as vantagens dele, a animação do dado e o vencedor marcado.
- **Pedido a Celebi:** botões 🌸 para refazer a rolagem — dado de movimento (cada dado, com Green), captura que falhou, derrota no Ginásio, Duelos (o seu dado ou o do adversário, que pode bloquear com Poké-Boneca) e Eventos de dado (Cassino, Pescaria, Safari, Encontro Raro). Por enquanto só para quem está jogando a vez. O prêmio do Duelo agora é entregue ao fechar o resultado.
- **Prêmio da Arena de Gelo automático:** quem vence o Duelo, mesmo que não seja quem ativou o Evento, vê os 2 próximos Eventos, escolhe um e o ativa na hora; o outro vai para o descarte.
- **May (copiar Evento):** quem tem a May como Treinadora ganha a opção "♻️ Reciclar a May" na janela de reações dos Eventos e Super Eventos ativados por um oponente. A cópia é executada como a do Exp. Share, na ordem da mesa. A May vai para o descarte e o jogador compra um Treinador novo na hora.
- **Wally automático:** sempre que um jogador com Wally e pelo menos 1 Item for comprar Itens por um Evento/Super Evento (inclusive cópias e prêmios de ranking) ou por vitória em batalha (Ginásio e prêmio de Duelo), o jogo pergunta se ele quer descartar um Item da mão para comprar 1 a mais. A IA descarta só Itens fracos.
- **Criadores Pokémon automático:** escolha entre (1) descartar 2 Pokémons da mesma linha evolutiva e pegar qualquer Azul ou mais fraco fora do jogo, (2) descartar 3 e pegar qualquer Pokémon fora do jogo, ou (3) comprar 2 Itens. As opções sem Pokémons suficientes ficam desativadas e os Pokémons fora do jogo aparecem por cor, dos mais fortes para os mais fracos. Os descartados voltam para a pilha da cor deles.
- **Operação Aqua, Operação Magma e Pedido a Arceus automáticos:**
  - **Operação Aqua:** cada oponente escolhe o Item que descarta (com 1 só, é automático) ou se protege com Poké-Boneca. Depois, quem ativou pega até 3 Itens, um de cada vez, entre os descartados nessa Operação ou da pilha, e pode parar antes.
  - **Operação Magma:** os oponentes descartam os Treinadores (Poké-Boneca protege). Quem ativou pode trocar o seu por um deles ou manter o atual. Depois, quem ficou sem Treinador compra um novo na hora.
  - **Pedido a Arceus:** compra 2 Super Eventos e distribui para 2 jogadores diferentes (você pode ficar com um). Cada um ativa o seu, começando por quem ativou o Pedido.
- **Exp. Share e Poké-Flauta (janela de reações):** quando um Evento ou Super Evento é revelado e alguém tem um desses Itens, aparece **"⏳ Aguardando reações…"** por 5 segundos para todos (abrir o próprio painel dá mais 5 s). Quem tem o Item clica no próprio nome e escolhe; quem não responde, não usa. Ninguém vê quem tem o quê.
  - **Poké-Flauta** (qualquer jogador, inclusive quem ativou): cancela o Evento, que vai para o descarte, e revela o próximo do mesmo baralho, com nova janela. Se alguém tocou a Flauta, os Exp. Share daquela carta não são gastos.
  - **Exp. Share** (só oponentes): depois do Evento original, cada cópia é executada na ordem da mesa a partir de quem ativou. Cartas com efeito manual mostram um aviso no registro.
  - A IA também reage: Flauta contra Evento ruim para ela ou bom para o adversário; Exp. Share em Eventos vantajosos.
- **Pokémons recebidos na tela do Evento:** depois de "Ativar efeito", as cartas dos Pokémons ganhos aparecem na própria janela (com o nome de quem recebeu, quando não é você); clique para ampliar.
- **Resultado do Parque Nacional:** tela final com a classificação, as capturas de cada jogador (com miniaturas) e o prêmio recebido.
- **Duelos com arena:** os dois Pokémons lado a lado, com a conta da força (base, evolução, treinador, vantagem, local, item com ícone), a animação dos dois dados e a marcação de quem venceu e quem perdeu.
- **Festival Pokémon automático:** cada jogador pode trocar 1 Pokémon (quem ativou, até 2) por outro aleatório da mesma cor.
- **Animação de dado nos Eventos com rolagem** (Pescaria, Cassino, Zona do Safari, Encontro Raro): o dado rola e depois mostra o valor e o que ele dá; fecha sozinho em ~2 s ou com um clique.
- **Pedido a Jirachi automático:** 3 Eventos (ou 1 por jogador, se forem menos) para jogadores diferentes, você incluído.
- **Prof. Juniper automático** (cada um escolhe o Item que dá; depois os dois ganham um Rosa).
- **Registro interativo:** nomes de Eventos, Itens, Treinadores, Líderes e Pokémons ficam sublinhados; passe o mouse para ver a carta e o texto, clique para ampliar.
- **PokéNav Plus automático:** lista todos os jogadores (inclusive você), respeita a Poké-Boneca e o alvo escolhe entre 2 Treinadores novos. A IA também passa a usar o item.
- Correções: o visual dos 2 dados do Green e Celadon, que não dava os 3 Itens da Primeira visita.

## Versão anterior

- **Líderes visíveis:** passe o mouse sobre uma cidade para ver o Líder, a força, o tipo e as vantagens. Clicando, aparecem os detalhes e a sua chance estimada de vitória. O botão **Líderes** mostra todos os que estão em jogo. Um ✓ na cor do jogador marca quem já venceu aquele Líder.
- **Adversários controlados pelo computador:** na tela inicial, cada jogador tem o botão 🙂 Humano / 🤖 IA. A IA rola, anda, captura (decide quando gastar Bolas), enfrenta Líderes quando a chance compensa, escolhe Treinadores, trava famílias e descarta Itens.
  - Quando uma carta da IA tem efeito manual, o jogo para e pede que um humano aplique o efeito pela caixa de ferramentas e clique em **Concluir**.
  - Dá para pausar a IA e escolher a velocidade (lenta, normal ou rápida).
- **Tema claro:** botão ☀️/🌙 no rodapé ou na tela inicial. A escolha fica salva.

## O que já é automático

- **Tabuleiro:** sorteio dos 6 hexágonos do meio (2 por tier, em cima ou embaixo), montagem e emenda dos caminhos.
- **Início:** Pokémon inicial, 1 Item e 1 Treinador para cada jogador.
- **Movimento:**
  - destinos válidos destacados;
  - parada antecipada em cidades;
  - passagens de tipo (só passa quem tem o tipo no time);
  - passagens de Item (custo no sentido da seta);
  - Planalto (exige 6 insígnias e a primeira chegada encerra o movimento);
  - circuito de mão única do E2;
  - Trem para cidades já visitadas;
  - Green, Hiker, Lyra e Corda de Fuga.
- **Captura:**
  - Bolas (±1, ±2 e ±4) e Marcador de Enfraquecido (±1);
  - especialistas (±1) e Red (2 dados);
  - reposição da carta no espaço;
  - Lendários não ficam enfraquecidos.
- **Força:**
  - grupo de dois (+2) e de três (+4), aplicado ao mais evoluído;
  - Eevee e Slowpoke no máximo +2;
  - família travada (+1) e GS Ball (+1);
  - treinadores (especialistas, Alder, Ethan e May);
  - vantagens de tipo (+2 por tipo).
- **Ginásios:**
  - obediência por insígnia e batalhas DUAL;
  - itens de batalha e Remédio;
  - empate a favor do jogador;
  - insígnia com o rosto do líder;
  - recompensas das 6 insígnias, na ordem do gamepad.
- **Cidades:** Pioneiro e Primeira visita. Os efeitos simples (comprar Itens, Treinador, Evento, ganhar ou tentar capturar Pokémon) já se aplicam sozinhos.
- **Espaços especiais:**
  - X2, X3 e X4 (compre N e tente capturar um);
  - Evento X2 (compre 2 e escolha);
  - Planalto (trava uma família na chegada);
  - "Começar a Liga" (exige uma volta completa no E2; sem ela, o jogador só compra um Item) e a Liga Mata-Mata completa.
- **Eventos e Super Eventos:**
  - cerca de 35 cartas com efeito automático;
  - as outras mostram o texto e se resolvem pela **Caixa de ferramentas**, que cobre comprar cartas, ganhar ou capturar Pokémon, trocar, roubar Item, mover peão, perder a vez, +1 e batalha entre jogadores com os bônus de Duelo;
  - baralhos reembaralham sozinhos quando acabam.
- **Fim do turno:** limite de Itens (6, 8 com Backpacker, 3 com Alder) e turno extra da Bicicleta.

## O que ainda é manual (próximas versões)

- **Liga Pokémon:** formato Elite 4.
- **Cartas que dependem de reação fora do turno:** Pedido a Celebi fora do próprio turno (fora da Liga).
- **Avatares dos personagens** na escolha da cor.

## Estrutura

```
web/            o jogo (é isso que vai para o GitHub Pages)
  index.html
  css/style.css
  js/engine.js  regras (sem tela; testado com 40 partidas simuladas)
  js/ai.js      adversários controlados pelo computador
  js/ui.js      interface
  js/data.js    dados gerados (não editar à mão)
  img/          imagens em WebP (~13 MB)
dados/          catálogo das cartas (JSON legível, para revisar)
hex-mapa.json   mapeamento dos 34 hexágonos
mapeador.html   ferramenta de mapeamento
tools/          scripts que geraram tudo isso
```

Para mudar uma carta ou um hexágono, edite `dados/*.json` ou `hex-mapa.json` e rode
`python3 tools/build_data.py` para gerar de novo o `web/js/data.js`.

## Publicar no GitHub Pages

1. Crie um repositório e envie a pasta `web/` (ou o projeto inteiro, configurando o Pages para a pasta `web`).
2. Em *Settings → Pages*, escolha a branch e a pasta. O link fica `https://<usuario>.github.io/<repo>/`.
3. **Cuidado:** no plano gratuito o repositório e o site ficam públicos, com as imagens de Pokémon junto. Para uso entre amigos, com o link sem divulgação, o risco é baixo, mas existe.
