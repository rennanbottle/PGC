// Guia do guia: dicas de cada tela e o passeio que acende cada parte dela, um passo por vez.
// Cada passo aponta para um elemento marcado na tela com data-guia="nome". Se o elemento não estiver na tela
// (por exemplo, uma lista vazia), o passo é pulado.

export const PASSEIOS = {
  inicio: {
    caminho: '/inicio',
    nome: 'Início',
    dicas: [
      'O cartão grande mostra o próximo passo que vale mais a pena agora.',
      'A meta de hoje segue o seu ritmo. Dá para trocar o ritmo no perfil.',
      'Quanto mais dias seguidos você estuda, mais pontos ganha.',
    ],
    passos: [
      { alvo: 'inicio-proximo', titulo: 'Seu próximo passo', texto: 'Eu olho o que você já fez e mostro o que vale mais a pena agora. Um clique e você começa.' },
      { alvo: 'inicio-hoje', titulo: 'Hoje', texto: 'Quantas questões você fez hoje e quanto falta para a meta do seu ritmo.' },
      { alvo: 'inicio-semana', titulo: 'Sua semana', texto: 'Cada barra é um dia. Passe o mouse para ver o número de questões.' },
      { alvo: 'menu-materias', titulo: 'Comece pelas matérias', texto: 'Crie as matérias que você estuda na escola. Eu sugiro os assuntos de cada uma.' },
      { alvo: 'conta', titulo: 'Sua conta', texto: 'Perfil, histórico e esta ajuda ficam aqui, na sua foto.' },
    ],
  },
  materia: {
    caminho: '/materias/',
    nome: 'Matéria',
    dicas: [
      'Toque nas sugestões de assunto para adicionar vários de uma vez.',
      'Sem texto próprio? Peça para o PGC buscar um texto sobre cada assunto.',
    ],
    passos: [
      { alvo: 'materia-assuntos', titulo: 'Assuntos', texto: 'São as partes da matéria. Toque nas sugestões para adicionar de uma vez.' },
      { alvo: 'materia-textos', titulo: 'Textos', texto: 'De onde saem as questões. Envie o seu ou deixe o PGC buscar um texto para cada assunto.' },
      { alvo: 'materia-questoes', titulo: 'Questões', texto: 'Gere questões desta matéria com a IA ou sem ela, direto do texto.' },
      { alvo: 'materia-estudar', titulo: 'Estudar', texto: 'Com 10 questões no banco, este botão abre um estudo só desta matéria.' },
    ],
  },
  materias: {
    caminho: '/materias',
    nome: 'Matérias',
    dicas: [
      'Escreva só o nome da matéria: a área, a cor e os assuntos vêm sugeridos.',
      'Arraste os cartões para mudar a ordem, ou ordene por nome.',
    ],
    passos: [
      { alvo: 'materias-nova', titulo: 'Nova matéria', texto: 'Escreva o nome, como Português ou Python. Eu sugiro a área, a cor e os assuntos.' },
      { alvo: 'materias-lista', titulo: 'Suas matérias', texto: 'Cada cartão mostra os assuntos, os textos e as questões. Clique para abrir.' },
      { alvo: 'materias-filtros', titulo: 'Filtros', texto: 'Quando a lista crescer, use para achar uma matéria rapidinho.' },
    ],
  },
  biblioteca: {
    caminho: '/materiais',
    nome: 'Biblioteca',
    dicas: [
      'Arraste um PDF, cole um texto ou escreva um tema na mesma caixa.',
      'Texto buscado pelo PGC já chega conferido. Os seus você confere com um clique.',
    ],
    passos: [
      { alvo: 'biblioteca-adicionar', titulo: 'Adicionar', texto: 'Uma caixa só para tudo: arraste um arquivo, cole um texto ou escreva um tema para eu buscar.' },
      { alvo: 'biblioteca-lista', titulo: 'Seus textos', texto: 'Cada texto mostra a matéria e se já está pronto para virar questão.' },
    ],
  },
  gerar: {
    caminho: '/questoes/gerar',
    nome: 'Gerar questões',
    dicas: [
      'Com "Outra IA", você usa o ChatGPT ou o Gemini e traz a resposta de volta.',
      'Sem IA, as questões saem do próprio texto e não gastam a cota do dia.',
    ],
    passos: [
      { alvo: 'gerar-base', titulo: 'Do que estudar', texto: 'Escolha a matéria, os assuntos e, se quiser, os textos de base.' },
      { alvo: 'gerar-autor', titulo: 'Quem escreve', texto: 'Do próprio texto (sem IA), a IA do PGC, ou outra IA que você já usa.' },
      { alvo: 'gerar-formato', titulo: 'Como ficam', texto: 'Quantidade, nível, tipos e estilo das questões.' },
      { alvo: 'gerar-resumo', titulo: 'Resumo', texto: 'Confira tudo antes de gerar, inclusive quanto da cota de IA vai usar.' },
    ],
  },
  questoes: {
    caminho: '/questoes',
    nome: 'Questões',
    dicas: [
      'Gerar questões é o jeito mais rápido de encher o banco.',
      'Questões fora das revisões mostram o motivo e como resolver.',
    ],
    passos: [
      { alvo: 'questoes-gerar', titulo: 'Gerar questões', texto: 'O jeito mais rápido de encher o banco: a IA escreve e o PGC confere cada uma.' },
      { alvo: 'questoes-lista', titulo: 'Seu banco', texto: 'Todas as suas questões, com filtros por matéria, tipo e nível.' },
    ],
  },
  estudar: {
    caminho: '/revisar',
    nome: 'Estudar',
    dicas: [
      'As receitas montam um estudo pronto com um clique.',
      'Você pode pausar no meio: o estudo fica salvo no Início.',
    ],
    passos: [
      { alvo: 'estudar-comecar', titulo: 'Começar', texto: 'Escolha uma receita pronta ou monte o seu estudo do seu jeito.' },
      { alvo: 'estudar-conjuntos', titulo: 'Seus estudos', texto: 'Os estudos que você salva ficam aqui para repetir quando quiser.' },
    ],
  },
  prova: {
    caminho: '/prova',
    nome: 'Prova',
    dicas: [
      'Na prova não tem dica nem correção no meio: a nota sai quando você entrega.',
      'Marque a prova da escola na Agenda e faça um simulado antes dela.',
    ],
    passos: [
      { alvo: 'prova-montar', titulo: 'Montar prova', texto: 'Escolha as matérias, o formato (ENEM, vestibular, certo ou errado, escola) e o tempo.' },
      { alvo: 'prova-notas', titulo: 'Suas notas', texto: 'A última nota e a comparação com a prova anterior do mesmo formato.' },
    ],
  },
  'prova-nova': {
    caminho: '/prova/nova',
    nome: 'Montar prova',
    dicas: [
      'Assunto com mais peso tem mais questões na prova.',
      'Dá para trocar uma questão do caderno antes de começar.',
    ],
    passos: [
      { alvo: 'prova-cai', titulo: 'O que cai', texto: 'Escolha as matérias e os assuntos. Os mais fracos podem ganhar mais questões.' },
      { alvo: 'prova-formato', titulo: 'Formato', texto: 'ENEM, vestibular, certo ou errado (com desconto) ou do jeito da escola.' },
      { alvo: 'prova-tempo', titulo: 'Tamanho e tempo', texto: 'Quantas questões e quanto tempo. O relógio pode ficar sempre à vista ou só no fim.' },
      { alvo: 'prova-caderno', titulo: 'Caderno', texto: 'As questões que vão cair. Troque uma ou sorteie outras antes de começar.' },
    ],
  },
  assunto: {
    caminho: '/assuntos/',
    nome: 'Assunto',
    dicas: [
      'A prova de domínio abre quando todos os outros critérios estão cumpridos.',
      'Os critérios que faltam dizem o que fazer para cumprir cada um.',
    ],
    passos: [
      { alvo: 'assunto-proficiencia', titulo: 'Proficiência', texto: 'A nota do assunto, de 300 a 800, estudo a estudo. A linha tracejada é o que o domínio pede.' },
      { alvo: 'assunto-prova', titulo: 'Prova de domínio', texto: 'Uma prova curta, só deste assunto, sem dica. Passou, o assunto fica Dominado.' },
      { alvo: 'assunto-criterios', titulo: 'Critérios', texto: 'O que já está cumprido e o que falta, com a dica do que fazer.' },
    ],
  },
  agenda: {
    caminho: '/agenda',
    nome: 'Agenda',
    dicas: [
      'Marque a data das provas: o PGC monta um plano de estudo até lá.',
      'O número em cada dia é de revisões que vencem nele.',
    ],
    passos: [
      { alvo: 'agenda-calendario', titulo: 'Calendário', texto: 'Cada dia mostra provas, tarefas e quantas revisões vencem nele.' },
      { alvo: 'agenda-novo', titulo: 'Novo evento', texto: 'Marque provas, trabalhos e lembretes. Para uma prova, eu monto um plano até o dia.' },
      { alvo: 'agenda-lado', titulo: 'O dia escolhido', texto: 'Clique num dia para ver tudo dele e estudar o que vence.' },
    ],
  },
  ranking: {
    caminho: '/ranking',
    nome: 'Ranking',
    dicas: ['Seu desempenho é só seu. O ranking geral é opcional e mostra só o apelido.'],
    passos: [
      { alvo: 'ranking-voce', titulo: 'Você', texto: 'Seu desempenho: dias de estudo, acertos e matérias.' },
      { alvo: 'ranking-geral', titulo: 'Geral', texto: 'Se quiser, compare pontos com outras pessoas, só pelo apelido.' },
    ],
  },
  perfil: {
    caminho: '/perfil',
    nome: 'Perfil',
    dicas: ['Em computadores da escola, ligue a saída automática na parte Sessão.'],
    passos: [
      { alvo: 'perfil-estudo', titulo: 'Seu ritmo', texto: 'Quanto o PGC cobra de você por dia. Dá para trocar uma vez por semana.' },
      { alvo: 'perfil-sessao', titulo: 'Sessão', texto: 'Sair sozinho depois de um tempo parado, bom para computadores da escola.' },
    ],
  },
}

// Passeio da tela atual. Cada passeio vale só para a tela dele: "/prova" não vale para "/prova/nova" nem para a prova
// em andamento (lá as partes do passeio não existem, e o convite aparecia sem ter o que mostrar).
// Caminho terminado em "/" vale para as telas de dentro (ex.: "/materias/" pega /materias/abc, não /materias).
export function passeioDaRota(caminho = '') {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, '') : caminho
  for (const [id, p] of Object.entries(PASSEIOS)) {
    if (p.caminho.endsWith('/')) {
      const resto = limpo.slice(p.caminho.length)
      if (limpo.startsWith(p.caminho) && resto && !resto.includes('/') && resto !== 'nova') return { id, ...p }
    }
    else if (limpo === p.caminho) return { id, ...p }
  }
  return null
}
