// Questões: tipos, níveis, Bloom, origens, conteúdo de cada tipo e conferência de qualidade.
// O conteúdo fica num JSON por tipo (coluna "conteudo", migração 0006). O enunciado é sempre texto.
// Lacunas: o enunciado marca cada lacuna com três ou mais sublinhados (______).
import { conferirQuestaoEscolha, normalizar, textoComparavel } from './qualidadeQuestao.js'

// 17 tipos da V1, montados sobre 5 componentes de tela.
export const TIPOS = [
  { id: 'multipla_escolha', nome: 'Múltipla escolha', componente: 'escolher', resumo: '4 ou 5 alternativas, uma certa.' },
  { id: 'multipla_resposta', nome: 'Múltipla resposta', componente: 'escolher', resumo: 'Mais de uma alternativa certa.' },
  { id: 'verdadeiro_falso', nome: 'V ou F com justificativa', componente: 'escolher', resumo: 'Uma afirmação; quem responde explica o porquê.' },
  { id: 'certo_errado', nome: 'Certo ou errado', componente: 'escolher', resumo: 'Afirmação no estilo Cebraspe.' },
  { id: 'assercao_razao', nome: 'Asserção e razão', componente: 'escolher', resumo: 'Duas afirmações ligadas por PORQUE.' },
  { id: 'lacuna_opcoes', nome: 'Lacuna com opções', componente: 'escolher', resumo: 'Cada lacuna tem opções para escolher.' },
  { id: 'lacuna_digitada', nome: 'Lacuna digitada', componente: 'escrever', resumo: 'Quem responde escreve a palavra que falta.' },
  { id: 'associar', nome: 'Associar colunas', componente: 'arrastar', resumo: 'Ligar cada item ao seu par.' },
  { id: 'ordenar', nome: 'Ordenar', componente: 'arrastar', resumo: 'Colocar os itens na ordem certa.' },
  { id: 'classificar', nome: 'Classificar em grupos', componente: 'arrastar', resumo: 'Separar os itens nos grupos certos.' },
  { id: 'numerica', nome: 'Resposta numérica', componente: 'escrever', resumo: 'Um número, com tolerância e unidade.' },
  { id: 'encontrar_erro', nome: 'Encontrar o erro', componente: 'marcar', resumo: 'Uma resolução em passos, com um passo errado.' },
  { id: 'texto_base', nome: 'Texto-base', componente: 'escolher', resumo: 'Um texto para ler e uma pergunta de escolha sobre ele.' },
  { id: 'prever_resultado', nome: 'Prever o resultado', componente: 'escolher', resumo: 'Uma situação; quem responde diz o que acontece.' },
  { id: 'cartao', nome: 'Cartão', componente: 'cartao', resumo: 'Frente e verso. Quem responde escreve antes de virar.' },
  { id: 'resposta_curta', nome: 'Resposta curta', componente: 'escrever', resumo: 'Uma ou duas frases, conferidas por pontos-chave.' },
  { id: 'explicar', nome: 'Explique com suas palavras', componente: 'escrever', resumo: 'Explicação livre, conferida por pontos-chave.' },
]
export const TIPO = Object.fromEntries(TIPOS.map((t) => [t.id, t]))
export const nomeDoTipo = (id) => TIPO[id]?.nome ?? 'Questão'

// Tipos que usam a lista de alternativas com uma certa (e a conferência de Haladyna).
export const TIPOS_ESCOLHA = ['multipla_escolha', 'texto_base', 'prever_resultado']

export const NIVEIS = [
  { valor: 1, nome: 'Fácil' },
  { valor: 2, nome: 'Normal' },
  { valor: 3, nome: 'Difícil' },
  { valor: 4, nome: 'Muito difícil' },
  { valor: 5, nome: 'Desafio extremo' },
]
export const nomeDoNivel = (n) => NIVEIS.find((x) => x.valor === Number(n))?.nome ?? 'Normal'

export const BLOOM = [
  { valor: 1, nome: 'Lembrar' },
  { valor: 2, nome: 'Entender' },
  { valor: 3, nome: 'Aplicar' },
  { valor: 4, nome: 'Analisar' },
  { valor: 5, nome: 'Avaliar' },
  { valor: 6, nome: 'Criar' },
]
export const nomeDoBloom = (n) => BLOOM.find((x) => x.valor === Number(n))?.nome ?? 'Lembrar'

export const ORIGENS = {
  gerada: 'Gerada',
  material: 'Do material',
  importada: 'Importada',
  minha: 'Minha',
}

// Alternativas fixas da asserção e razão (modelo do ENADE).
export const OPCOES_ASSERCAO = [
  { id: 'a', texto: 'As duas são verdadeiras, e a segunda justifica a primeira.' },
  { id: 'b', texto: 'As duas são verdadeiras, mas a segunda não justifica a primeira.' },
  { id: 'c', texto: 'A primeira é verdadeira, e a segunda é falsa.' },
  { id: 'd', texto: 'A primeira é falsa, e a segunda é verdadeira.' },
  { id: 'e', texto: 'As duas são falsas.' },
]

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']
export const RE_LACUNA = /_{3,}/g
export const contarLacunas = (texto) => (String(texto ?? '').match(RE_LACUNA) ?? []).length

const alternativasVazias = (n = 4) => Array.from({ length: n }, (_, i) => ({ texto: '', correta: i === 0, erro: '' }))

// Conteúdo inicial de cada tipo no editor.
export function conteudoVazio(tipo) {
  switch (tipo) {
    case 'multipla_escolha':
    case 'prever_resultado':
      return { alternativas: alternativasVazias(4) }
    case 'texto_base':
      return { textoBase: '', alternativas: alternativasVazias(4) }
    case 'multipla_resposta':
      return { alternativas: alternativasVazias(5).map((a, i) => ({ ...a, correta: i < 2 })) }
    case 'verdadeiro_falso':
      return { verdadeira: true, justificativa: '' }
    case 'certo_errado':
      return { certo: true }
    case 'assercao_razao':
      return { assercao: '', razao: '', resposta: 'a' }
    case 'lacuna_opcoes':
      return { lacunas: [] }
    case 'lacuna_digitada':
      return { lacunas: [] }
    case 'associar':
      return { pares: [{ a: '', b: '' }, { a: '', b: '' }, { a: '', b: '' }] }
    case 'ordenar':
      return { itens: ['', '', ''] }
    case 'classificar':
      return { grupos: [{ nome: '', itens: ['', ''] }, { nome: '', itens: ['', ''] }] }
    case 'numerica':
      return { resposta: null, tolerancia: 1, unidade: '' }
    case 'encontrar_erro':
      return { linhas: ['', '', ''], errada: 1, correcao: '' }
    case 'cartao':
      return { verso: '' }
    case 'resposta_curta':
      return { resposta: '', pontos: [''] }
    case 'explicar':
      return { resposta: '', pontos: ['', ''] }
    default:
      return {}
  }
}

// Ao trocar o tipo no editor, aproveita o que der: alternativas entre os tipos de escolha, itens entre listas.
export function trocarTipo(conteudo, de, para) {
  const novo = conteudoVazio(para)
  const c = conteudo ?? {}
  if (c.alternativas && novo.alternativas) {
    novo.alternativas = c.alternativas.map((a) => ({ ...a }))
    if (para !== 'multipla_resposta') {
      const certa = Math.max(0, novo.alternativas.findIndex((a) => a.correta))
      novo.alternativas.forEach((a, i) => (a.correta = i === certa))
    }
  }
  if (c.textoBase && 'textoBase' in novo) novo.textoBase = c.textoBase
  if (c.itens && novo.itens) novo.itens = [...c.itens]
  if (c.pontos && novo.pontos) novo.pontos = [...c.pontos]
  if (c.resposta && typeof c.resposta === 'string' && 'resposta' in novo && typeof novo.resposta === 'string') novo.resposta = c.resposta
  if (c.lacunas && novo.lacunas && de?.startsWith('lacuna') && para?.startsWith('lacuna')) {
    novo.lacunas = c.lacunas.map((l) => (para === 'lacuna_digitada'
      ? { respostas: l.respostas ?? (l.opcoes ? [l.opcoes[l.certa ?? 0]].filter(Boolean) : []) }
      : { opcoes: l.opcoes ?? [...(l.respostas ?? []).slice(0, 1), '', ''], certa: l.certa ?? 0 }))
  }
  return novo
}

// Deixa as lacunas do conteúdo do mesmo tamanho que as lacunas do enunciado.
export function ajustarLacunas(enunciado, conteudo, tipo) {
  const n = contarLacunas(enunciado)
  const lacunas = [...(conteudo?.lacunas ?? [])].slice(0, n)
  while (lacunas.length < n) lacunas.push(tipo === 'lacuna_opcoes' ? { opcoes: ['', '', ''], certa: 0 } : { respostas: [''] })
  return { ...conteudo, lacunas }
}

const vazio = (t) => !String(t ?? '').trim()
const preenchidos = (lista) => (lista ?? []).filter((x) => !vazio(x))
function repetidos(lista) {
  const vistos = new Set()
  for (const x of lista) {
    const n = textoComparavel(x)
    if (vistos.has(n)) return true
    vistos.add(n)
  }
  return false
}

// Conferência de qualidade de qualquer tipo. Falha reprova; dois avisos também reprovam.
// Questão importada (prova antiga, lista): só as falhas de estrutura contam, porque não há o erro
// que cada alternativa representa nem como reescrever o original.
// Questão escrita pela pessoa (propria): o erro de cada alternativa errada é opcional (aviso, não falha).
export function conferirQuestao(q, { importada = false, propria = false } = {}) {
  const problemas = []
  const falha = (id, texto) => problemas.push({ id, nivel: 'falha', texto })
  const aviso = (id, texto) => problemas.push({ id, nivel: 'aviso', texto })
  const c = q.conteudo ?? {}
  const tipo = q.tipo

  if (String(q.enunciado ?? '').trim().length < 8) falha('enunciado', 'O enunciado está curto demais.')

  if (TIPOS_ESCOLHA.includes(tipo)) {
    if (tipo === 'texto_base' && String(c.textoBase ?? '').trim().length < 40) falha('texto_base', 'O texto-base precisa de pelo menos 40 caracteres.')
    const alts = (c.alternativas ?? []).filter((a) => !vazio(a.texto))
    if (alts.length < (c.alternativas ?? []).length) falha('alternativa_vazia', 'Há alternativa sem texto.')
    if (importada) {
      if (alts.length < 2 || alts.length > 6) falha('quantidade', 'A questão precisa de 2 a 6 alternativas.')
      if (alts.filter((a) => a.correta).length !== 1) falha('gabarito', 'Marque a alternativa certa.')
      if (repetidos(alts.map((a) => a.texto))) falha('repetida', 'Há alternativas iguais.')
    }
    else {
      const opcional = (p) => (propria && p.id === 'erro_representado' ? { ...p, nivel: 'aviso', texto: 'Vale dizer que erro de raciocínio leva a cada alternativa errada.' } : p)
      problemas.push(...conferirQuestaoEscolha({ enunciado: q.enunciado, alternativas: alts }).problemas.map(opcional))
    }
  }
  else if (tipo === 'multipla_resposta') {
    const alts = (c.alternativas ?? []).filter((a) => !vazio(a.texto))
    const certas = alts.filter((a) => a.correta).length
    if (alts.length < 4 || alts.length > 6) falha('quantidade', 'A questão precisa de 4 a 6 alternativas.')
    if (certas < 2) falha('gabarito', 'Marque pelo menos duas alternativas certas. Com uma só, use múltipla escolha.')
    if (certas === alts.length) falha('gabarito', 'Pelo menos uma alternativa precisa estar errada.')
    if (repetidos(alts.map((a) => a.texto))) falha('repetida', 'Há alternativas iguais.')
    if (!importada && alts.some((a) => !a.correta && vazio(a.erro))) (propria ? aviso : falha)('erro_representado', 'Toda alternativa errada precisa dizer que erro de raciocínio ela representa.')
  }
  else if (tipo === 'verdadeiro_falso') {
    if (typeof c.verdadeira !== 'boolean') falha('gabarito', 'Diga se a afirmação é verdadeira ou falsa.')
    if (!importada && String(c.justificativa ?? '').trim().length < 10) falha('justificativa', 'Escreva a justificativa esperada.')
  }
  else if (tipo === 'certo_errado') {
    if (typeof c.certo !== 'boolean') falha('gabarito', 'Diga se o item está certo ou errado.')
  }
  else if (tipo === 'assercao_razao') {
    if (vazio(c.assercao) || vazio(c.razao)) falha('afirmacoes', 'Escreva as duas afirmações.')
    if (!OPCOES_ASSERCAO.some((o) => o.id === c.resposta)) falha('gabarito', 'Escolha a resposta certa.')
  }
  else if (tipo === 'lacuna_opcoes' || tipo === 'lacuna_digitada') {
    const n = contarLacunas(q.enunciado)
    const lacunas = c.lacunas ?? []
    if (n === 0) falha('lacuna', 'Marque a lacuna no enunciado com três sublinhados (___).')
    else if (lacunas.length !== n) falha('lacuna', 'Cada lacuna do enunciado precisa da sua resposta.')
    if (tipo === 'lacuna_digitada' && lacunas.some((l) => !preenchidos(l.respostas).length)) falha('resposta', 'Toda lacuna precisa de pelo menos uma resposta aceita.')
    if (tipo === 'lacuna_opcoes') {
      if (lacunas.some((l) => preenchidos(l.opcoes).length < 3 || preenchidos(l.opcoes).length !== (l.opcoes ?? []).length)) falha('opcoes', 'Toda lacuna precisa de pelo menos 3 opções preenchidas.')
      if (lacunas.some((l) => repetidos(preenchidos(l.opcoes)))) falha('repetida', 'Há opções iguais numa lacuna.')
      if (lacunas.some((l) => !(Number.isInteger(l.certa) && l.certa >= 0 && l.certa < (l.opcoes ?? []).length))) falha('gabarito', 'Marque a opção certa de cada lacuna.')
    }
  }
  else if (tipo === 'associar') {
    const pares = (c.pares ?? []).filter((p) => !vazio(p.a) || !vazio(p.b))
    if (pares.length < 3 || pares.length > 8) falha('quantidade', 'Use de 3 a 8 pares.')
    if (pares.some((p) => vazio(p.a) || vazio(p.b))) falha('par_incompleto', 'Há par com um lado vazio.')
    if (repetidos(pares.map((p) => p.a)) || repetidos(pares.map((p) => p.b))) falha('repetida', 'Há itens repetidos numa das colunas.')
  }
  else if (tipo === 'ordenar') {
    const itens = preenchidos(c.itens)
    if (itens.length < 3 || itens.length > 10) falha('quantidade', 'Use de 3 a 10 itens.')
    if (itens.length < (c.itens ?? []).length) falha('item_vazio', 'Há item sem texto.')
    if (repetidos(itens)) falha('repetida', 'Há itens iguais.')
  }
  else if (tipo === 'classificar') {
    const grupos = c.grupos ?? []
    const itens = grupos.flatMap((g) => preenchidos(g.itens))
    if (grupos.length < 2 || grupos.length > 4) falha('quantidade', 'Use de 2 a 4 grupos.')
    if (grupos.some((g) => vazio(g.nome))) falha('grupo_sem_nome', 'Todo grupo precisa de nome.')
    if (grupos.some((g) => !preenchidos(g.itens).length)) falha('grupo_vazio', 'Todo grupo precisa de pelo menos um item.')
    if (itens.length < 4 || itens.length > 16) falha('quantidade_itens', 'Use de 4 a 16 itens no total.')
    if (repetidos(itens)) falha('repetida', 'O mesmo item aparece duas vezes.')
  }
  else if (tipo === 'numerica') {
    const varios = Array.isArray(c.respostas) ? c.respostas : []
    if (varios.length) {
      if (varios.length < 2 || varios.length > 4) falha('quantidade', 'Use de 2 a 4 respostas, ou uma só.')
      if (varios.some((r) => typeof r?.valor !== 'number' || !Number.isFinite(r.valor))) falha('resposta', 'Escreva cada resposta como número.')
    }
    else if (typeof c.resposta !== 'number' || !Number.isFinite(c.resposta)) falha('resposta', 'Escreva a resposta como número.')
    if (!(Number(c.tolerancia) >= 0 && Number(c.tolerancia) <= 20)) falha('tolerancia', 'A tolerância vai de 0% a 20%.')
  }
  else if (tipo === 'encontrar_erro') {
    const linhas = c.linhas ?? []
    if (preenchidos(linhas).length < 3 || preenchidos(linhas).length < linhas.length) falha('linhas', 'Escreva pelo menos 3 passos, todos preenchidos.')
    if (!(Number.isInteger(c.errada) && c.errada >= 0 && c.errada < linhas.length)) falha('gabarito', 'Marque o passo errado.')
    if (vazio(c.correcao)) falha('correcao', 'Escreva como fica o passo corrigido.')
  }
  else if (tipo === 'cartao') {
    if (vazio(c.verso)) falha('verso', 'Escreva o verso do cartão.')
    else if (normalizar(c.verso) === normalizar(q.enunciado)) falha('repetida', 'Frente e verso estão iguais.')
  }
  else if ((tipo === 'resposta_curta' || tipo === 'explicar') && importada) {
    // Questão aberta importada: entra como "resolver e comparar", sem resposta modelo obrigatória.
  }
  else if (tipo === 'resposta_curta' || tipo === 'explicar') {
    const minimo = tipo === 'explicar' ? 2 : 1
    if (String(c.resposta ?? '').trim().length < 10) falha('resposta', 'Escreva a resposta esperada.')
    if (preenchidos(c.pontos).length < minimo) falha('pontos', `Liste ${minimo === 1 ? 'pelo menos um ponto-chave' : 'pelo menos dois pontos-chave'} que a resposta precisa ter.`)
  }
  else {
    falha('tipo', 'Tipo de questão desconhecido.')
  }

  const falhas = problemas.filter((p) => p.nivel === 'falha').length
  const avisos = problemas.filter((p) => p.nivel === 'aviso').length
  return { aprovada: falhas === 0 && avisos < 2, falhas, avisos, problemas }
}

// Por que a questão está fora das revisões, em texto curto. Vazio quando ela entra.
export function situacaoDaQuestao(q) {
  if (q.status === 'arquivada') return { id: 'arquivada', texto: 'arquivada', tom: 'neutro' }
  if (q.status === 'rascunho') return { id: 'rascunho', texto: 'importação não conferida', tom: 'aviso' }
  if (q.material_mudou) return { id: 'material', texto: 'o texto de origem mudou', tom: 'aviso' }
  if (q.precisa_imagem) return { id: 'imagem', texto: 'precisa da imagem', tom: 'erro' }
  if (!q.gabarito_confirmado && !q.resolver_comparar) return { id: 'gabarito', texto: 'gabarito não confirmado', tom: 'aviso' }
  if (!q.qualidade_aprovada) return { id: 'qualidade', texto: 'aviso de qualidade', tom: 'aviso' }
  return null
}

export const SITUACOES_QUESTAO = [
  { id: 'em_revisao', nome: 'Prontas para estudar' },
  { id: 'gabarito', nome: 'Gabarito não confirmado' },
  { id: 'qualidade', nome: 'Aviso de qualidade' },
  { id: 'imagem', nome: 'Precisa da imagem' },
  { id: 'material', nome: 'O texto de origem mudou' },
  { id: 'arquivada', nome: 'Arquivadas' },
]

// Prepara a questão para gravar: limpa listas vazias, confere a qualidade e devolve os campos da tabela.
export function prepararParaGravar(q, opcoes = {}) {
  const c = structuredClone(q.conteudo ?? {})
  if (c.alternativas) c.alternativas = c.alternativas.map((a) => ({ texto: String(a.texto ?? '').trim(), correta: !!a.correta, ...(vazio(a.erro) ? {} : { erro: String(a.erro).trim() }) })).filter((a) => a.texto)
  if (c.itens) c.itens = preenchidos(c.itens).map((x) => x.trim())
  if (c.pontos) c.pontos = preenchidos(c.pontos).map((x) => x.trim())
  if (c.pares) c.pares = c.pares.filter((p) => !vazio(p.a) || !vazio(p.b)).map((p) => ({ a: String(p.a).trim(), b: String(p.b).trim() }))
  if (c.grupos) c.grupos = c.grupos.map((g) => ({ nome: String(g.nome ?? '').trim(), itens: preenchidos(g.itens).map((x) => x.trim()) }))
  if (c.lacunas) c.lacunas = c.lacunas.map((l) => (l.respostas ? { respostas: preenchidos(l.respostas).map((x) => x.trim()) } : { opcoes: (l.opcoes ?? []).map((x) => String(x).trim()), certa: l.certa }))
  const resultado = conferirQuestao({ ...q, conteudo: c }, opcoes)
  return {
    campos: {
      tipo: q.tipo,
      enunciado: String(q.enunciado ?? '').trim(),
      conteudo: c,
      explicacao: vazio(q.explicacao) ? null : String(q.explicacao).trim(),
      nivel: Number(q.nivel) || 2,
      bloom: Number(q.bloom) || 1,
      qualidade_aprovada: resultado.aprovada,
      avisos_qualidade: resultado.problemas,
    },
    resultado,
  }
}

// Enunciado de uma linha para listas e busca.
export function enunciadoCurto(texto, maximo = 140) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim()
  return t.length > maximo ? `${t.slice(0, maximo - 1).trimEnd()}…` : t
}

// Trecho curto para listas, mostrado com <TextoRico>: bloco de código (```) vira código na linha e o corte nunca
// deixa um ` aberto (senão o resto apareceria com a crase).
export function trechoParaLista(texto, maximo = 220) {
  const t = String(texto ?? '')
    .replace(/```[^\n`]*\n?([\s\S]*?)```/g, (_, codigo) => {
      const linhas = codigo.split('\n').map((l) => l.trim()).filter(Boolean).join(' ')
      return linhas ? ` \`${linhas}\` ` : ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= maximo) return t
  let corte = t.slice(0, maximo - 1).trimEnd()
  if ((corte.match(/`/g) ?? []).length % 2) corte += '`'
  return `${corte}…`
}
