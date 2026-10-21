// Histórico: tudo o que a pessoa fez no PGC, do mais novo ao mais antigo, agrupado por dia (horário de Brasília).
// Junta estudos concluídos, textos da Biblioteca, matérias criadas, questões criadas (por dia e origem) e os marcos
// de pontos (bônus e assuntos que mudaram de estado). Os pontos comuns de cada estudo já aparecem no próprio estudo.

const FUSO = 'America/Sao_Paulo'
const FORMATO_DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

const tempo = (x) => new Date(x).getTime()
const meioDia = (dia) => new Date(`${dia}T12:00:00Z`)

// "2026-10-08" para um instante, no horário de Brasília. null quando não há data válida.
export function diaDe(instante) {
  if (!instante) return null
  const d = instante instanceof Date ? instante : new Date(instante)
  return Number.isNaN(d.getTime()) ? null : FORMATO_DIA.format(d)
}

export function somarDias(dia, n) {
  const d = meioDia(dia)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const diasEntre = (de, ate) => Math.round((meioDia(ate) - meioDia(de)) / 86400000)

// Primeiro dia do mês, "meses" meses antes do mês de "dia" (0 = o próprio mês).
export function inicioDoMes(dia, meses = 0) {
  const [a, m] = dia.split('-').map(Number)
  const total = a * 12 + (m - 1) - meses
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

export const nomeDoMes = (dia) => MESES[Number(dia.slice(5, 7)) - 1]

// "Hoje", "Ontem" ou "segunda-feira, 5 de outubro" (com o ano quando não é o ano de hoje).
export function rotuloDoDia(dia, hoje) {
  const dif = diasEntre(dia, hoje)
  if (dif === 0) return 'Hoje'
  if (dif === 1) return 'Ontem'
  const d = meioDia(dia)
  const ano = dia.slice(0, 4) === hoje.slice(0, 4) ? '' : ` de ${dia.slice(0, 4)}`
  return `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}${ano}`
}

// "hoje", "ontem", "há 3 dias" (até 6 dias) ou "28/9".
export function quandoFoi(instante, hoje) {
  const dia = diaDe(instante)
  if (!dia) return ''
  const dif = diasEntre(dia, hoje)
  if (dif <= 0) return 'hoje'
  if (dif === 1) return 'ontem'
  if (dif < 7) return `há ${dif} dias`
  return `${Number(dia.slice(8))}/${Number(dia.slice(5, 7))}`
}

export const TIPOS_EVENTO = [
  { valor: 'estudo', texto: 'Estudos' },
  { valor: 'questoes', texto: 'Questões criadas' },
  { valor: 'texto', texto: 'Textos' },
  { valor: 'materia', texto: 'Matérias' },
  { valor: 'marco', texto: 'Marcos e bônus' },
]

export const PERIODOS_HISTORICO = [
  { valor: 'tudo', texto: 'Tudo' },
  { valor: '7', texto: 'Últimos 7 dias' },
  { valor: 'mes', texto: 'Este mês' },
  { valor: 'mes_passado', texto: 'Mês passado' },
]

// Pontos que viram uma linha própria (os outros fazem parte dos pontos do estudo).
export const MARCOS = {
  dias_seguidos: () => 'Bônus de dias seguidos de estudo',
  proficiente: (n) => (n === 1 ? 'Um assunto ficou Proficiente' : `${n} assuntos ficaram Proficientes`),
  recuperou: (n) => (n === 1 ? 'Um assunto voltou a Proficiente' : `${n} assuntos voltaram a Proficiente`),
  dominado: (n) => (n === 1 ? 'Um assunto ficou Dominado' : `${n} assuntos ficaram Dominados`),
  revisao_no_dia: (n) => (n === 1 ? 'Revisão feita no dia marcado' : `${n} revisões feitas no dia marcado`),
}
export const MOTIVOS_MARCO = Object.keys(MARCOS)

export const ORIGENS_QUESTAO = {
  gerada: (n) => (n === 1 ? '1 questão gerada' : `${n} questões geradas`),
  material: (n) => (n === 1 ? '1 questão tirada de um texto' : `${n} questões tiradas de textos`),
  importada: (n) => (n === 1 ? '1 questão importada de uma prova' : `${n} questões importadas de provas`),
  minha: (n) => (n === 1 ? '1 questão escrita por você' : `${n} questões escritas por você`),
}

const ORDEM = { estudo: 0, marco: 1, questoes: 2, texto: 3, materia: 4 }

export const acertoDoEstudo = (r) =>
  Math.round((100 * (Number(r.certas ?? 0) + 0.5 * Number(r.parciais ?? 0))) / Math.max(1, Number(r.respondidas ?? 0)))

// Junta as linhas das tabelas numa lista só, do mais novo ao mais antigo.
export function montarLinhaDoTempo({ revisoes = [], materiais = [], materias = [], questoes = [], pontos = [] } = {}) {
  const eventos = []
  for (const r of revisoes) {
    const dia = diaDe(r.concluida_em)
    if (!dia || (r.status && r.status !== 'concluida')) continue
    eventos.push({
      id: `estudo:${r.id}`, tipo: 'estudo', quando: r.concluida_em, dia, ref: r.id, titulo: r.titulo,
      respondidas: Number(r.respondidas ?? 0), total: Number(r.total ?? 0), acerto: acertoDoEstudo(r),
      pontos: Number(r.pontos ?? 0), minutos: Math.round(Number(r.segundos ?? 0) / 60), encerradaAntes: !!r.encerrada_antes,
      prova: r.tipo === 'prova',
    })
  }
  for (const m of materiais) {
    const dia = diaDe(m.criado_em)
    if (dia) eventos.push({ id: `texto:${m.id}`, tipo: 'texto', quando: m.criado_em, dia, ref: m.id, titulo: m.titulo, materiaId: m.materia_id ?? null, arquivado: !!m.arquivado_em })
  }
  for (const m of materias) {
    const dia = diaDe(m.criado_em)
    if (dia) eventos.push({ id: `materia:${m.id}`, tipo: 'materia', quando: m.criado_em, dia, ref: m.id, titulo: m.nome, cor: m.cor ?? 'cinza', arquivada: !!m.arquivada_em })
  }

  const grupos = new Map()
  for (const q of questoes) {
    const dia = diaDe(q.criado_em)
    if (!dia || !ORIGENS_QUESTAO[q.origem]) continue
    const chave = `${dia}:${q.origem}`
    const g = grupos.get(chave) ?? { id: `questoes:${chave}`, tipo: 'questoes', quando: q.criado_em, dia, origem: q.origem, n: 0, porMateria: {} }
    g.n += 1
    if (tempo(q.criado_em) > tempo(g.quando)) g.quando = q.criado_em
    if (q.materia_id) g.porMateria[q.materia_id] = (g.porMateria[q.materia_id] ?? 0) + 1
    grupos.set(chave, g)
  }
  for (const { porMateria, ...g } of grupos.values()) {
    const materias = Object.entries(porMateria).sort((a, b) => b[1] - a[1]).map(([id]) => id)
    eventos.push({ ...g, titulo: ORIGENS_QUESTAO[g.origem](g.n), materias })
  }

  const marcos = new Map()
  for (const p of pontos) {
    const dia = diaDe(p.criado_em)
    if (!dia || !MARCOS[p.motivo]) continue
    const chave = `${dia}:${p.motivo}`
    const g = marcos.get(chave) ?? { id: `marco:${chave}`, tipo: 'marco', quando: p.criado_em, dia, motivo: p.motivo, n: 0, pontos: 0 }
    g.n += 1
    g.pontos += Number(p.pontos ?? 0)
    if (tempo(p.criado_em) > tempo(g.quando)) g.quando = p.criado_em
    marcos.set(chave, g)
  }
  for (const g of marcos.values()) eventos.push({ ...g, titulo: MARCOS[g.motivo](g.n) })

  return eventos.sort((a, b) => tempo(b.quando) - tempo(a.quando) || ORDEM[a.tipo] - ORDEM[b.tipo])
}

export function filtrarEventos(eventos = [], { tipo = '', periodo = 'tudo' } = {}, hoje) {
  const mes = hoje.slice(0, 7)
  const passado = inicioDoMes(hoje, 1).slice(0, 7)
  const desde7 = somarDias(hoje, -6)
  return eventos.filter((e) => {
    if (tipo && e.tipo !== tipo) return false
    if (periodo === '7') return e.dia >= desde7
    if (periodo === 'mes') return e.dia.startsWith(mes)
    if (periodo === 'mes_passado') return e.dia.startsWith(passado)
    return true
  })
}

// Lista já ordenada vira [{ dia, rotulo, eventos }].
export function agruparPorDia(eventos = [], hoje) {
  const dias = []
  for (const e of eventos) {
    const ultimo = dias.at(-1)
    if (ultimo?.dia === e.dia) ultimo.eventos.push(e)
    else dias.push({ dia: e.dia, rotulo: rotuloDoDia(e.dia, hoje), eventos: [e] })
  }
  return dias
}

// Mês atual contra o anterior: estudos, respostas, pontos dos estudos, dias com estudo, textos e questões criadas.
// "mesmoPeriodo" conta o mês anterior só até o mesmo dia de hoje (dia 1 a 8 contra dia 1 a 8): comparação justa.
export function resumoDoMes(eventos = [], hoje) {
  const contar = (prefixo, ateDia = '31') => {
    const r = { estudos: 0, respostas: 0, pontos: 0, textos: 0, questoes: 0 }
    const dias = new Set()
    for (const e of eventos) {
      if (!e.dia.startsWith(prefixo) || e.dia.slice(8) > ateDia) continue
      if (e.tipo === 'estudo') {
        r.estudos += 1
        r.respostas += e.respondidas
        r.pontos += e.pontos
        dias.add(e.dia)
      }
      else if (e.tipo === 'texto') r.textos += 1
      else if (e.tipo === 'questoes') r.questoes += e.n
    }
    return { ...r, dias: dias.size }
  }
  const anterior = inicioDoMes(hoje, 1)
  return {
    mes: nomeDoMes(hoje),
    mesAnterior: nomeDoMes(anterior),
    diaDeHoje: Number(hoje.slice(8)),
    atual: contar(hoje.slice(0, 7)),
    anterior: contar(anterior.slice(0, 7)),
    mesmoPeriodo: contar(anterior.slice(0, 7), hoje.slice(8)),
  }
}

// Respostas dos estudos em cada dia do mês atual, do dia 1 até hoje.
export function respostasPorDia(eventos = [], hoje) {
  const soma = {}
  for (const e of eventos) if (e.tipo === 'estudo') soma[e.dia] = (soma[e.dia] ?? 0) + e.respondidas
  const lista = []
  for (let dia = inicioDoMes(hoje); dia <= hoje; dia = somarDias(dia, 1)) lista.push({ dia, valor: soma[dia] ?? 0 })
  return lista
}
