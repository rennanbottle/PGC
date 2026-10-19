// Catálogo de matérias comuns na escola e nos cursos técnicos do Brasil. Funções puras.
// Serve para sugerir área, cor e assuntos quando a pessoa escreve o nome de uma matéria nova.
// Os assuntos vêm na ordem em que costumam aparecer na escola.

export const CATALOGO = [
  { id: 'matematica', nome: 'Matemática', aliases: ['mat', 'matematica basica', 'math'], area: 'matematica', cor: 'azul', assuntos: ['Conjuntos numéricos', 'Razão e proporção', 'Porcentagem', 'Equações do 1º grau', 'Funções do 1º grau', 'Funções do 2º grau', 'Função exponencial e logaritmos', 'Progressões (PA e PG)', 'Trigonometria', 'Geometria plana', 'Geometria espacial', 'Probabilidade e estatística'] },
  { id: 'portugues', nome: 'Português', aliases: ['lingua portuguesa', 'gramatica', 'portugues instrumental'], area: 'portugues', cor: 'vermelho', assuntos: ['Ortografia e acentuação', 'Classes de palavras', 'Formação de palavras', 'Concordância verbal e nominal', 'Regência', 'Crase', 'Pontuação', 'Período simples', 'Período composto', 'Interpretação de texto', 'Figuras de linguagem', 'Variação linguística'] },
  { id: 'literatura', nome: 'Literatura', aliases: ['literatura brasileira', 'literatura portuguesa'], area: 'portugues', cor: 'roxo', assuntos: ['Gêneros literários', 'Trovadorismo', 'Quinhentismo', 'Barroco', 'Arcadismo', 'Romantismo', 'Realismo e Naturalismo', 'Parnasianismo', 'Simbolismo', 'Pré-Modernismo', 'Modernismo', 'Literatura contemporânea'] },
  { id: 'redacao', nome: 'Redação', aliases: ['producao de texto', 'producao textual', 'redacao enem'], area: 'portugues', cor: 'rosa', assuntos: ['Gêneros textuais', 'Texto dissertativo-argumentativo', 'Tema e recorte', 'Tese', 'Argumentação', 'Repertório sociocultural', 'Coesão e conectivos', 'Coerência', 'Proposta de intervenção', 'Competências do ENEM'] },
  { id: 'fisica', nome: 'Física', aliases: ['fis'], area: 'natureza', cor: 'roxo', assuntos: ['Grandezas e unidades', 'Cinemática', 'Leis de Newton', 'Trabalho e energia', 'Quantidade de movimento', 'Gravitação', 'Hidrostática', 'Termologia', 'Óptica', 'Ondulatória', 'Eletricidade', 'Magnetismo'] },
  { id: 'quimica', nome: 'Química', aliases: ['quim'], area: 'natureza', cor: 'amarelo', assuntos: ['Matéria e suas propriedades', 'Modelos atômicos', 'Tabela periódica', 'Ligações químicas', 'Funções inorgânicas', 'Reações químicas', 'Estequiometria', 'Soluções', 'Termoquímica', 'Cinética química', 'Equilíbrio químico', 'Química orgânica'] },
  { id: 'biologia', nome: 'Biologia', aliases: ['bio', 'ciencias biologicas'], area: 'natureza', cor: 'verde', assuntos: ['Citologia', 'Bioquímica', 'Divisão celular', 'Genética', 'Evolução', 'Ecologia', 'Microbiologia', 'Botânica', 'Zoologia', 'Fisiologia humana', 'Biotecnologia'] },
  { id: 'historia', nome: 'História', aliases: ['historia geral', 'historia do brasil', 'hist'], area: 'humanas', cor: 'laranja', assuntos: ['Antiguidade clássica', 'Idade Média', 'Renascimento e Reforma', 'Grandes Navegações', 'Brasil Colônia', 'Revolução Francesa', 'Revolução Industrial', 'Brasil Império', 'Primeira República', 'Era Vargas', 'Guerras Mundiais', 'Ditadura militar no Brasil'] },
  { id: 'geografia', nome: 'Geografia', aliases: ['geo'], area: 'humanas', cor: 'verde', assuntos: ['Cartografia', 'Relevo e geologia', 'Clima', 'Hidrografia', 'Biomas', 'População', 'Urbanização', 'Agropecuária', 'Indústria e energia', 'Globalização', 'Geopolítica', 'Questões ambientais'] },
  { id: 'filosofia', nome: 'Filosofia', aliases: ['filo'], area: 'humanas', cor: 'cinza', assuntos: ['O que é filosofia', 'Pré-socráticos', 'Sócrates, Platão e Aristóteles', 'Filosofia medieval', 'Racionalismo e empirismo', 'Iluminismo', 'Kant', 'Ética e moral', 'Filosofia política', 'Existencialismo'] },
  { id: 'sociologia', nome: 'Sociologia', aliases: ['socio'], area: 'humanas', cor: 'amarelo', assuntos: ['Surgimento da sociologia', 'Émile Durkheim', 'Max Weber', 'Karl Marx', 'Cultura e identidade', 'Desigualdade social', 'Trabalho e sociedade', 'Movimentos sociais', 'Cidadania e direitos', 'Estado e política'] },
  { id: 'ingles', nome: 'Inglês', aliases: ['lingua inglesa', 'english'], area: 'idiomas', cor: 'vermelho', assuntos: ['Verb to be', 'Simple present', 'Simple past', 'Present continuous', 'Future (will e going to)', 'Present perfect', 'Modal verbs', 'Pronomes', 'Comparativos e superlativos', 'Conditionals', 'Interpretação de texto', 'Falsos cognatos'] },
  { id: 'espanhol', nome: 'Espanhol', aliases: ['lingua espanhola', 'espanol'], area: 'idiomas', cor: 'amarelo', assuntos: ['Alfabeto e pronúncia', 'Artigos e contrações', 'Pronomes pessoais', 'Presente do indicativo', 'Pretérito indefinido', 'Futuro', 'Verbos irregulares', 'Heterossemânticos', 'Interpretação de texto', 'Vocabulário do dia a dia'] },
  { id: 'artes', nome: 'Artes', aliases: ['arte', 'educacao artistica', 'historia da arte'], area: 'artes', cor: 'rosa', assuntos: ['Elementos da linguagem visual', 'Arte pré-histórica', 'Arte grega e romana', 'Arte medieval', 'Renascimento', 'Barroco', 'Impressionismo', 'Vanguardas europeias', 'Semana de Arte Moderna', 'Arte contemporânea', 'Música', 'Teatro'] },
  { id: 'educacao-fisica', nome: 'Educação Física', aliases: ['ed fisica', 'edf', 'educacao fisica'], area: 'saude', cor: 'verde', assuntos: ['Atividade física e saúde', 'Capacidades físicas', 'Alimentação e exercício', 'Esportes coletivos', 'Esportes individuais', 'Lutas', 'Ginástica', 'Dança', 'Jogos e brincadeiras', 'Primeiros socorros'] },
  { id: 'logica', nome: 'Lógica de programação', aliases: ['algoritmos', 'algoritmo', 'logica', 'programacao'], area: 'programacao', cor: 'azul', assuntos: ['Algoritmos', 'Variáveis e tipos de dados', 'Operadores', 'Entrada e saída', 'Estruturas condicionais', 'Estruturas de repetição', 'Vetores', 'Matrizes', 'Funções', 'Recursão', 'Pseudocódigo e fluxogramas'] },
  { id: 'python', nome: 'Python', aliases: ['py', 'python 3'], area: 'programacao', cor: 'verde', assuntos: ['Primeiro programa', 'Variáveis e tipos', 'Operadores', 'Strings', 'Condicionais', 'Laços for e while', 'Listas e tuplas', 'Dicionários e conjuntos', 'Funções', 'Arquivos', 'Tratamento de erros', 'Classes e objetos'] },
  { id: 'javascript', nome: 'JavaScript', aliases: ['js', 'java script'], area: 'programacao', cor: 'amarelo', assuntos: ['Variáveis (let e const)', 'Tipos e operadores', 'Condicionais', 'Laços', 'Funções', 'Arrays', 'Objetos', 'DOM', 'Eventos', 'Promises e async/await', 'Fetch e APIs', 'Módulos'] },
  { id: 'html-css', nome: 'HTML e CSS', aliases: ['html', 'css', 'desenvolvimento web', 'web'], area: 'programacao', cor: 'laranja', assuntos: ['Estrutura de uma página', 'Textos e listas', 'Links e imagens', 'Tabelas', 'Formulários', 'HTML semântico', 'Seletores CSS', 'Box model', 'Flexbox', 'Grid', 'Responsividade'] },
  { id: 'java', nome: 'Java', aliases: [], area: 'programacao', cor: 'vermelho', assuntos: ['Sintaxe básica', 'Variáveis e tipos', 'Operadores', 'Condicionais', 'Laços', 'Arrays', 'Métodos', 'Classes e objetos', 'Encapsulamento', 'Herança', 'Polimorfismo', 'Exceções'] },
  { id: 'banco-dados', nome: 'Banco de dados', aliases: ['bd', 'sql', 'mysql', 'bancos de dados'], area: 'programacao', cor: 'roxo', assuntos: ['Conceitos de banco de dados', 'Modelo entidade-relacionamento', 'Modelo relacional', 'Normalização', 'Criar tabelas (DDL)', 'Consultas com SELECT', 'Filtros e ordenação', 'Junções (JOIN)', 'Funções de agregação', 'Índices', 'Transações'] },
  { id: 'redes', nome: 'Redes de computadores', aliases: ['redes', 'rede de computadores'], area: 'programacao', cor: 'cinza', assuntos: ['Conceitos de redes', 'Topologias', 'Modelo OSI', 'TCP/IP', 'Endereçamento IP', 'Sub-redes', 'Equipamentos de rede', 'Cabeamento', 'Redes sem fio', 'DNS e DHCP', 'Segurança de redes'] },
  { id: 'informatica', nome: 'Informática básica', aliases: ['informatica', 'computacao', 'introducao a computacao'], area: 'programacao', cor: 'azul', assuntos: ['Hardware e software', 'Sistemas operacionais', 'Arquivos e pastas', 'Editor de texto', 'Planilhas', 'Apresentações', 'Internet e e-mail', 'Segurança digital', 'Atalhos de teclado'] },
  { id: 'administracao', nome: 'Administração', aliases: ['adm', 'gestao', 'administracao geral'], area: 'negocios', cor: 'azul', assuntos: ['Teorias da administração', 'Planejamento', 'Organização', 'Direção e liderança', 'Controle', 'Gestão de pessoas', 'Marketing', 'Logística', 'Gestão financeira', 'Empreendedorismo'] },
  { id: 'contabilidade', nome: 'Contabilidade', aliases: ['contabil', 'contabilidade geral'], area: 'negocios', cor: 'verde', assuntos: ['Patrimônio', 'Ativo, passivo e patrimônio líquido', 'Débito e crédito', 'Plano de contas', 'Lançamentos contábeis', 'Balancete', 'Balanço patrimonial', 'DRE', 'Depreciação', 'Custos'] },
  { id: 'economia', nome: 'Economia', aliases: ['eco'], area: 'negocios', cor: 'amarelo', assuntos: ['Conceitos básicos', 'Oferta e demanda', 'Estruturas de mercado', 'Moeda e bancos', 'Inflação', 'PIB e crescimento', 'Juros', 'Comércio internacional', 'Desenvolvimento econômico'] },
  { id: 'marketing', nome: 'Marketing', aliases: ['mkt'], area: 'negocios', cor: 'rosa', assuntos: ['Conceito de marketing', 'Mix de marketing (4 Ps)', 'Comportamento do consumidor', 'Pesquisa de mercado', 'Segmentação', 'Marca', 'Marketing digital', 'Redes sociais', 'Plano de marketing'] },
  { id: 'direito', nome: 'Direito', aliases: ['legislacao', 'nocoes de direito', 'introducao ao direito'], area: 'direito', cor: 'vermelho', assuntos: ['Introdução ao Direito', 'Constituição Federal', 'Direitos fundamentais', 'Organização do Estado', 'Direito civil', 'Direito penal', 'Direito do trabalho', 'Direito do consumidor', 'Direito administrativo', 'Processo'] },
  { id: 'eletronica', nome: 'Eletrônica', aliases: ['eletronica analogica', 'eletronica digital'], area: 'exatas', cor: 'laranja', assuntos: ['Grandezas elétricas', 'Lei de Ohm', 'Resistores', 'Leis de Kirchhoff', 'Capacitores', 'Indutores', 'Diodos', 'Transistores', 'Amplificadores operacionais', 'Sistemas de numeração', 'Portas lógicas', 'Circuitos digitais'] },
  { id: 'eletricidade', nome: 'Eletricidade', aliases: ['eletrotecnica', 'eletrica', 'instalacoes eletricas'], area: 'exatas', cor: 'amarelo', assuntos: ['Carga e corrente elétrica', 'Tensão e potência', 'Circuitos em série e paralelo', 'Corrente alternada', 'Instalações elétricas', 'Dispositivos de proteção', 'Motores elétricos', 'Transformadores', 'Segurança em eletricidade (NR-10)'] },
  { id: 'desenho-tecnico', nome: 'Desenho técnico', aliases: ['desenho', 'cad'], area: 'exatas', cor: 'cinza', assuntos: ['Instrumentos de desenho', 'Caligrafia técnica', 'Escalas', 'Cotagem', 'Projeções ortogonais', 'Perspectiva isométrica', 'Cortes e seções', 'Desenho no computador (CAD)'] },
  { id: 'anatomia', nome: 'Anatomia', aliases: ['anatomia humana', 'anatomia e fisiologia'], area: 'saude', cor: 'vermelho', assuntos: ['Introdução à anatomia', 'Sistema esquelético', 'Sistema muscular', 'Sistema nervoso', 'Sistema cardiovascular', 'Sistema respiratório', 'Sistema digestório', 'Sistema urinário', 'Sistema endócrino', 'Sistema reprodutor', 'Sistema tegumentar'] },
  { id: 'enfermagem', nome: 'Enfermagem', aliases: ['tecnico em enfermagem', 'fundamentos de enfermagem'], area: 'saude', cor: 'azul', assuntos: ['Fundamentos de enfermagem', 'Sinais vitais', 'Biossegurança', 'Primeiros socorros', 'Administração de medicamentos', 'Curativos', 'Saúde coletiva', 'Saúde da mulher', 'Saúde da criança', 'Ética profissional'] },
]

// Matérias mostradas primeiro quando a pessoa ainda não tem nenhuma (as mais comuns no ensino médio).
const COMUNS = ['matematica', 'portugues', 'historia', 'biologia', 'fisica', 'quimica', 'geografia', 'ingles', 'redacao']

export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const POR_ID = Object.fromEntries(CATALOGO.map((m) => [m.id, m]))
export const doCatalogo = (id) => POR_ID[id] ?? null

// Nota de quanto o texto combina com um nome (menor é melhor; null = não combina).
function nota(nome, termo, base) {
  const n = normalizar(nome)
  if (n === termo) return base
  if (n.startsWith(termo)) return base + 2
  if (n.split(/[\s\-(/]+/).some((p) => p.startsWith(termo))) return base + 4
  return null
}

// Sugestões enquanto a pessoa digita: ignora acentos e maiúsculas; nome exato, apelido exato,
// começo do nome, começo do apelido e começo de uma palavra, nessa ordem.
export function sugerirMateria(texto, limite = 5) {
  const termo = normalizar(texto)
  if (!termo) return []
  const achadas = []
  CATALOGO.forEach((m, i) => {
    const notas = [nota(m.nome, termo, 0), ...m.aliases.map((a) => nota(a, termo, 1))].filter((x) => x !== null)
    if (notas.length) achadas.push({ m, pontos: Math.min(...notas), i })
  })
  return achadas.sort((a, b) => a.pontos - b.pontos || a.i - b.i).slice(0, limite).map((x) => x.m)
}

// A matéria do catálogo com este nome (ou apelido). "Matemática 2" e "Física I" também valem.
export function acharMateria(nome) {
  const termo = normalizar(nome)
  if (!termo) return null
  const exata = CATALOGO.find((m) => normalizar(m.nome) === termo || m.aliases.includes(termo))
  if (exata) return exata
  return CATALOGO.find((m) => [m.nome, ...m.aliases].some((n) => {
    const chave = normalizar(n)
    return termo.startsWith(`${chave} `) && /^[\divx]+$|^(basica|geral|i+)$/.test(termo.slice(chave.length + 1))
  })) ?? null
}

// Assuntos sugeridos para a matéria, na ordem da escola, sem os que a pessoa já tem.
export function assuntosSugeridos(nome, existentes = []) {
  const m = acharMateria(nome)
  if (!m) return []
  const tem = new Set(existentes.map(normalizar))
  return m.assuntos.filter((a) => !tem.has(normalizar(a)))
}

// Atalhos para criar matérias: as mais comuns intercaladas com as das áreas de interesse (uma de cada área por vez).
export function materiasParaComecar(areas = [], existentes = [], limite = 6) {
  const tem = new Set(existentes.map(normalizar))
  const livres = CATALOGO.filter((m) => !tem.has(normalizar(m.nome)))
  const comuns = COMUNS.map((id) => POR_ID[id]).filter((m) => !tem.has(normalizar(m.nome)))
  const porArea = areas.map((a) => livres.filter((m) => m.area === a))
  const rodizio = []
  for (let i = 0; i < 12; i++) for (const lista of porArea) if (lista[i]) rodizio.push(lista[i])
  const escolha = []
  for (let i = 0; escolha.length < limite && i < Math.max(comuns.length, rodizio.length); i++) {
    for (const m of [comuns[i], rodizio[i]]) {
      if (m && !escolha.includes(m) && escolha.length < limite) escolha.push(m)
    }
  }
  return escolha
}
