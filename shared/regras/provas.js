// Regras da Prova (simulado): formatos, tempo sugerido, relógio, cartão-resposta e nota.
// Na prova entram só questões que o PGC corrige sozinho (nada de autoavaliação), as respostas ficam guardadas sem
// correção até a pessoa entregar, e a nota sai de uma vez. Usadas na montagem, durante a prova e no resultado.
import { LETRAS, TIPOS } from './questoes.js'
import { escolherQuestoes } from './revisoes.js'

// Tipos que dependem da própria pessoa corrigir (comparando com os pontos esperados) ficam de fora.
export const TIPOS_AUTOCORRIGIDOS = TIPOS.map((t) => t.id).filter((t) => !['cartao', 'resposta_curta', 'explicar'].includes(t))

export const FORMATOS = [
  {
    id: 'enem',
    nome: 'ENEM',
    descricao: 'Escolha com 5 alternativas, quase sempre com um texto antes da pergunta.',
    tipos: ['texto_base', 'multipla_escolha'],
    minutos: 3,
  },
  {
    id: 'vestibular',
    nome: 'Vestibular',
    descricao: 'Escolha mais direta, com uma ou mais certas e asserção e razão.',
    tipos: ['multipla_escolha', 'texto_base', 'multipla_resposta', 'assercao_razao', 'prever_resultado'],
    minutos: 3,
  },
  {
    id: 'certo_errado',
    nome: 'Certo ou errado',
    descricao: 'Cada item é certo ou errado. Uma errada anula uma certa; em branco não desconta.',
    tipos: ['certo_errado', 'verdadeiro_falso'],
    minutos: 1.5,
    desconto: true,
  },
  {
    id: 'escola',
    nome: 'Escola',
    descricao: 'Escolha, V ou F, lacunas, associar, ordenar e contas, como na prova da sala.',
    tipos: TIPOS_AUTOCORRIGIDOS,
    minutos: 4,
  },
]
// A prova de domínio usa a mesma tela da prova, mas não aparece na escolha de formato: ela é montada pelo PGC, com
// as questões difíceis de um assunto só (shared/regras/provaDominio.js).
export const FORMATO_DOMINIO = {
  id: 'dominio',
  nome: 'Prova de domínio',
  descricao: 'Questões de nível difícil ou acima de um assunto só, sem dica.',
  tipos: TIPOS_AUTOCORRIGIDOS,
  minutos: 3,
}
export const formatoDe = (id) => (id === FORMATO_DOMINIO.id ? FORMATO_DOMINIO : FORMATOS.find((f) => f.id === id) ?? FORMATOS[0])

export const QUANTIDADES = [10, 20, 30, 45, 60]
export const QUANTAS_MIN = 5
export const QUANTAS_MAX = 60 // o mesmo limite de um estudo (revisoes.total)
export const MINUTOS_MIN = 5
export const MINUTOS_MAX = 300
export const MAX_TITULO_PROVA = 80

export const RELOGIOS = [
  { id: 'sempre', nome: 'Sempre à vista' },
  { id: 'final', nome: 'Só nos 10 últimos minutos' },
  { id: 'escondido', nome: 'Escondido' },
]
export const ORDENS = [
  { id: 'misturada', nome: 'Misturada' },
  { id: 'materia', nome: 'Por matéria' },
]
// Avisos de tempo (em segundos restantes), como o fiscal avisando na sala.
export const AVISOS_TEMPO = [600, 300]

// Tempo sugerido em minutos: o do formato por questão, arredondado para cima de 5 em 5.
export function tempoSugerido(formato, quantas) {
  const bruto = formatoDe(formato).minutos * Math.max(0, Number(quantas) || 0)
  return Math.min(MINUTOS_MAX, Math.max(MINUTOS_MIN, Math.ceil(bruto / 5) * 5))
}

const doisDigitos = (n) => String(n).padStart(2, '0')
// Relógio da prova: 1:05:09 ou 05:09.
export function relogio(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${doisDigitos(m)}:${doisDigitos(s % 60)}` : `${doisDigitos(m)}:${doisDigitos(s % 60)}`
}
// Duração por extenso curto: 2h 15min, 1h, 45 min, menos de 1 min.
export function duracao(segundos) {
  const min = Math.round(Math.max(0, Number(segundos) || 0) / 60)
  if (min < 1) return 'menos de 1 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h}h ${m}min` : `${h}h`
}
// O relógio aparece? "final" mostra só quando faltam 10 minutos ou menos; a pessoa pode sempre abrir na hora.
export const relogioVisivel = (modo, restante) => modo === 'sempre' || (modo === 'final' && restante <= AVISOS_TEMPO[0])

// A resposta guardada já diz alguma coisa? (em branco não conta na nota nem desconta)
export function respostaPreenchida(tipo, resposta) {
  const r = resposta ?? {}
  switch (tipo) {
    case 'multipla_escolha': case 'texto_base': case 'prever_resultado': return Number.isInteger(r.escolha)
    case 'multipla_resposta': return (r.marcadas ?? []).length > 0
    case 'verdadeiro_falso': case 'certo_errado': return r.valor === true || r.valor === false
    case 'assercao_razao': return !!r.opcao
    case 'lacuna_digitada': return (r.textos ?? []).some((t) => String(t ?? '').trim())
    case 'lacuna_opcoes': return (r.escolhas ?? []).some((t) => t !== undefined && t !== null)
    case 'associar': return Object.values(r.ligacoes ?? {}).some((v) => v !== '' && v !== null && v !== undefined)
    case 'ordenar': return Array.isArray(r.ordem) && r.ordem.length > 0
    case 'classificar': return Object.keys(r.grupos ?? {}).length > 0
    case 'numerica': return String(r.valor ?? '').trim() !== '' || (r.valores ?? []).some((v) => String(v ?? '').trim() !== '')
    case 'encontrar_erro': return r.linha !== undefined && r.linha !== null
    default: return false
  }
}

const ESCOLHA = ['multipla_escolha', 'texto_base', 'prever_resultado', 'multipla_resposta']
// Uma linha do cartão-resposta. Escolha: bolinhas A a E (marcada e, depois de entregar, a certa).
// Certo ou errado e V ou F: duas bolinhas. Outros tipos: só se foi respondida.
export function linhaDoCartao(item) {
  const q = item?.questao ?? {}
  const tipo = q.tipo ?? item?.tipo
  const resposta = item?.resposta ?? {}
  const detalhe = item?.correcao?.detalhe ?? null
  const resultado = item?.correcao?.resultado ?? null
  if (ESCOLHA.includes(tipo)) {
    const multipla = tipo === 'multipla_resposta'
    const marcadas = multipla ? resposta.marcadas ?? [] : Number.isInteger(resposta.escolha) ? [resposta.escolha] : []
    const certas = detalhe ? (multipla ? detalhe.certas ?? [] : [detalhe.certa]) : []
    return {
      tipo: 'bolinhas',
      opcoes: LETRAS.slice(0, Math.min(LETRAS.length, (q.alternativas ?? []).length)).map((letra, k) => ({ letra, marcada: marcadas.includes(k), certa: certas.includes(k) })),
      respondida: marcadas.length > 0,
      resultado,
    }
  }
  if (tipo === 'certo_errado' || tipo === 'verdadeiro_falso') {
    const nomes = tipo === 'certo_errado' ? ['C', 'E'] : ['V', 'F']
    return {
      tipo: 'bolinhas',
      opcoes: [true, false].map((v, k) => ({ letra: nomes[k], marcada: resposta.valor === v, certa: detalhe ? detalhe.certa === v : false })),
      respondida: resposta.valor === true || resposta.valor === false,
      resultado,
    }
  }
  return { tipo: 'texto', opcoes: [], respondida: respostaPreenchida(tipo, resposta), resultado }
}

// Nota da prova. Certa vale 1 e parcial vale meio. No certo ou errado, cada errada desconta uma certa (a nota
// líquida nunca fica abaixo de zero). Em branco não soma nem desconta.
export function notaDaProva(itens, formato) {
  let certas = 0
  let parciais = 0
  let erradas = 0
  let emBranco = 0
  for (const i of itens ?? []) {
    const r = i?.correcao?.resultado
    if (!r || r === 'em_branco') emBranco++
    else if (r === 'correta') certas++
    else if (r === 'parcial') parciais++
    else erradas++
  }
  const total = (itens ?? []).length
  const desconto = !!formatoDe(formato).desconto
  const bruta = certas + parciais / 2
  const liquida = Math.max(0, desconto ? bruta - erradas : bruta)
  return { total, certas, parciais, erradas, emBranco, bruta, liquida, desconto, porcentagem: total ? Math.round((liquida / total) * 100) : 0 }
}

// Acerto por matéria, da maior para a menor quantidade de questões. assuntos: { [id]: { materia, cor } }.
export function notaPorMateria(itens, assuntos = {}) {
  const grupos = new Map()
  for (const i of itens ?? []) {
    const a = assuntos[i.assuntoId] ?? {}
    const chave = a.materia ?? 'Sem matéria'
    const g = grupos.get(chave) ?? { materia: chave, cor: a.cor ?? 'cinza', total: 0, certas: 0, parciais: 0 }
    g.total++
    if (i.correcao?.resultado === 'correta') g.certas++
    else if (i.correcao?.resultado === 'parcial') g.parciais++
    grupos.set(chave, g)
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, porcentagem: g.total ? Math.round(((g.certas + g.parciais / 2) / g.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total || a.materia.localeCompare(b.materia))
}

const inteiroEntre = (v, min, max, padrao) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Lê o pedido de montar uma prova (vale no navegador e no servidor). Devolve { config } ou { erro }.
export function lerConfigProva(corpo = {}) {
  // Só os formatos da tela de montar: a prova de domínio tem rota própria.
  const formato = (FORMATOS.find((f) => f.id === corpo.formato) ?? FORMATOS[0]).id
  const assuntos = []
  const vistos = new Set()
  for (const a of Array.isArray(corpo.assuntos) ? corpo.assuntos : []) {
    const id = String(a?.id ?? '')
    if (!UUID.test(id) || vistos.has(id)) continue
    vistos.add(id)
    assuntos.push({ id, peso: inteiroEntre(a?.peso, 1, 10, 5) })
  }
  if (!assuntos.length) return { erro: 'Escolha pelo menos um assunto.' }
  if (assuntos.length > 60) return { erro: 'Escolha até 60 assuntos.' }
  const quantas = inteiroEntre(corpo.quantas, QUANTAS_MIN, QUANTAS_MAX, 20)
  const minutos = inteiroEntre(corpo.minutos, MINUTOS_MIN, MINUTOS_MAX, tempoSugerido(formato, quantas))
  const titulo = String(corpo.titulo ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO_PROVA) || `Simulado ${formatoDe(formato).nome}`
  return {
    config: {
      titulo,
      formato,
      assuntos,
      quantas,
      minutos,
      relogio: RELOGIOS.some((r) => r.id === corpo.relogio) ? corpo.relogio : 'sempre',
      ordem: ORDENS.some((o) => o.id === corpo.ordem) ? corpo.ordem : 'misturada',
      fracos: corpo.fracos !== false,
    },
  }
}

// "6 fáceis, 10 normais e 4 difíceis." a partir de { 1: 6, 2: 10, 3: 4 } (níveis de 1 a 5).
const PLURAL_NIVEL = { 1: ['fácil', 'fáceis'], 2: ['normal', 'normais'], 3: ['difícil', 'difíceis'], 4: ['muito difícil', 'muito difíceis'], 5: ['de desafio extremo', 'de desafio extremo'] }
export function textoPorNivel(contagem = {}) {
  const partes = [1, 2, 3, 4, 5].filter((n) => (contagem[n] ?? 0) > 0).map((n) => `${contagem[n]} ${PLURAL_NIVEL[n][contagem[n] === 1 ? 0 : 1]}`)
  if (!partes.length) return ''
  return `${partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : partes[0]}.`
}

// Dificuldade do caderno, como numa prova de verdade: um quarto fácil, metade normal, um quarto difícil.
export const DIFICULDADE_PROVA = { modo: 'distribuir', contas: { 1: 1, 2: 2, 3: 1 } }

// ---------- Caderno ----------
// pool: candidatas do banco { id, assunto_id, materia_id, tipo, nivel, b, vencida, nova, recente }.
// Assuntos fracos (theta abaixo de zero) ganham até o dobro do peso; "por matéria" deixa os assuntos de uma
// matéria seguidos. Devolve a lista de questões do caderno.
export function sortearCaderno(pool, config, { rng = Math.random, thetas = {} } = {}) {
  const tipos = new Set(formatoDe(config.formato).tipos)
  const validas = pool.filter((q) => tipos.has(q.tipo))
  let assuntos = config.assuntos
  if (config.fracos) assuntos = assuntos.map((a) => ({ ...a, peso: a.peso * (1 + Math.min(1, Math.max(0, -(thetas[a.id] ?? 0)))) }))
  if (config.ordem === 'materia') {
    const materiaDe = new Map(validas.map((q) => [q.assunto_id, q.materia_id]))
    const ordem = [...new Set(assuntos.map((a) => materiaDe.get(a.id) ?? ''))]
    assuntos = [...assuntos].sort((a, b) => ordem.indexOf(materiaDe.get(a.id) ?? '') - ordem.indexOf(materiaDe.get(b.id) ?? ''))
  }
  return escolherQuestoes(validas, {
    quantidade: config.quantas, assuntos, tipos: [...tipos], origem: 'banco',
    ordem: config.ordem === 'materia' ? 'assunto' : 'intercalada', dificuldade: DIFICULDADE_PROVA,
  }, { rng }).itens
}

// Mantém o caderno da prévia (só as questões que ainda valem) e troca as pedidas por outra do mesmo assunto
// (ou de qualquer assunto escolhido, se o assunto acabou).
export function trocarNoCaderno(pool, caderno, trocar = [], { rng = Math.random, quantas = QUANTAS_MAX, formato = 'enem' } = {}) {
  const tipos = new Set(formatoDe(formato).tipos)
  const porId = new Map(pool.filter((q) => tipos.has(q.tipo)).map((q) => [q.id, q]))
  const lista = [...new Set(caderno)].map((id) => porId.get(id)).filter(Boolean).slice(0, quantas)
  const usadas = new Set(lista.map((q) => q.id))
  for (const id of trocar) {
    const k = lista.findIndex((q) => q.id === id)
    if (k < 0) continue
    const livres = [...porId.values()].filter((q) => !usadas.has(q.id))
    const mesmas = livres.filter((q) => q.assunto_id === lista[k].assunto_id)
    const opcoes = mesmas.length ? mesmas : livres
    if (!opcoes.length) continue
    const nova = opcoes[Math.floor(rng() * opcoes.length)]
    usadas.add(nova.id)
    lista[k] = nova
  }
  return lista
}
