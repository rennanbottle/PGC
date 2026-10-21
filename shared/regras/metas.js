// Metas da Agenda: o que a pessoa quer cumprir toda semana (de domingo a sábado) ou até uma data.
// Tipos: questões respondidas, minutos de estudo, estudos feitos e assuntos dominados (este só com data, porque conta
// o estado de agora). Pode valer para uma matéria ou para todas. O progresso é contado no servidor; aqui ficam o
// período de cada meta, a conta do "no ritmo", o título e os textos.
import { diaCurto, diferencaDias, inicioDaSemana, somarDias } from './agenda.js'

export const TIPOS_META = {
  questoes: { id: 'questoes', nome: 'Responder questões', verbo: 'Responder', um: 'questão', varios: 'questões', feminino: true, semana: true, sugestao: 100 },
  minutos: { id: 'minutos', nome: 'Minutos de estudo', verbo: 'Estudar', um: 'minuto', varios: 'minutos', semana: true, sugestao: 180 },
  estudos: { id: 'estudos', nome: 'Estudos feitos', verbo: 'Fazer', um: 'estudo', varios: 'estudos', semana: true, sugestao: 3 },
  dominar: { id: 'dominar', nome: 'Dominar assuntos', verbo: 'Dominar', um: 'assunto', varios: 'assuntos', semana: false, sugestao: 3 },
}
export const LISTA_TIPOS_META = Object.values(TIPOS_META)
export const LIMITES_META = { alvo: 10000, ativas: 20, prazoDias: 366 }

const plural = (n, tipo) => (n === 1 ? tipo.um : tipo.varios)

// Confere o que veio da janela. Devolve { ok, erros: { campo: mensagem }, meta } com a meta pronta para gravar.
export function validarMeta(corpo = {}, hoje) {
  const erros = {}
  const tipo = TIPOS_META[corpo.tipo]
  if (!tipo) erros.tipo = 'Escolha o tipo da meta.'
  const alvo = Number(corpo.alvo)
  if (!Number.isInteger(alvo) || alvo < 1) erros.alvo = 'Informe um número inteiro maior que zero.'
  else if (alvo > LIMITES_META.alvo) erros.alvo = `O máximo é ${LIMITES_META.alvo.toLocaleString('pt-BR')}.`
  const periodo = tipo && !tipo.semana ? 'data' : corpo.periodo === 'data' ? 'data' : 'semana'
  let prazo = null
  if (periodo === 'data') {
    prazo = typeof corpo.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(corpo.prazo) ? corpo.prazo : null
    if (!prazo) erros.prazo = 'Escolha até quando.'
    else if (prazo < hoje) erros.prazo = 'A data já passou. Escolha hoje ou um dia depois.'
    else if (diferencaDias(hoje, prazo) > LIMITES_META.prazoDias) erros.prazo = 'Escolha uma data dentro de um ano.'
  }
  const materiaId = typeof corpo.materia_id === 'string' && corpo.materia_id ? corpo.materia_id : null
  const ok = !Object.keys(erros).length
  return { ok, erros, meta: ok ? { tipo: tipo.id, alvo, periodo, prazo, materia_id: materiaId } : null }
}

// Período contado: a semana de hoje (domingo a sábado) ou do início da meta até o prazo.
export function periodoDaMeta(meta, hoje) {
  if (meta.periodo === 'semana') {
    const inicio = inicioDaSemana(hoje)
    return { inicio, fim: somarDias(inicio, 6) }
  }
  return { inicio: meta.inicio ?? hoje, fim: meta.prazo }
}

// "Responder 100 questões de Matemática por semana", "Dominar 3 assuntos até 20 de nov."
export function tituloDaMeta(meta, nomeMateria = '') {
  const tipo = TIPOS_META[meta.tipo] ?? TIPOS_META.questoes
  const de = nomeMateria ? ` de ${nomeMateria}` : ''
  const quando = meta.periodo === 'semana' ? ' por semana' : meta.prazo ? ` até ${diaCurto(meta.prazo)}` : ''
  return `${tipo.verbo} ${meta.alvo.toLocaleString('pt-BR')} ${plural(meta.alvo, tipo)}${de}${quando}`
}

// Situação da meta com o que já foi feito no período.
// estado: 'batida', 'no_ritmo', 'atras' (abaixo do esperado para os dias que passaram) ou 'vencida' (prazo passou).
// esperado: quanto já devia estar feito, contando os dias do período até hoje (inclusive).
export function situacaoDaMeta(meta, feito, hoje) {
  const tipo = TIPOS_META[meta.tipo] ?? TIPOS_META.questoes
  const alvo = Math.max(1, meta.alvo)
  const n = Math.max(0, Math.round(feito || 0))
  const { inicio, fim } = periodoDaMeta(meta, hoje)
  const totalDias = Math.max(1, diferencaDias(inicio, fim) + 1)
  const passados = Math.min(totalDias, Math.max(0, diferencaDias(inicio, hoje) + 1))
  const restantes = Math.max(0, diferencaDias(hoje, fim))
  const esperado = meta.tipo === 'dominar' ? null : Math.ceil((alvo * passados) / totalDias)
  const porcentagem = Math.min(100, Math.round((n / alvo) * 100))
  const falta = Math.max(0, alvo - n)
  let estado
  if (n >= alvo) estado = 'batida'
  else if (hoje > fim) estado = 'vencida'
  else if (esperado !== null && n < esperado) estado = 'atras'
  else estado = 'no_ritmo'
  return { feito: n, alvo, porcentagem, falta, esperado, estado, restantes, inicio, fim, texto: textoDaSituacao({ estado, falta, restantes, tipo, semana: meta.periodo === 'semana', esperado, n }) }
}

function textoDaSituacao({ estado, falta, restantes, tipo, semana, esperado, n }) {
  if (estado === 'batida') return semana ? 'Batida nesta semana.' : 'Meta batida.'
  if (estado === 'vencida') return `O prazo passou. Faltaram ${falta} ${plural(falta, tipo)}.`
  const quando = restantes === 0 ? (semana ? 'até o fim de hoje (a semana acaba hoje)' : 'até o fim de hoje') : `em ${restantes + 1} ${restantes + 1 === 1 ? 'dia' : 'dias'}`
  const base = `Faltam ${falta} ${plural(falta, tipo)} ${quando}.`
  if (estado === 'atras') return `${base} Para estar em dia, o esperado era ${esperado} até hoje (${n} feitos).`
  return base
}

export const NOME_ESTADO_META = { batida: 'Batida', no_ritmo: 'Em dia', atras: 'Atrasada', vencida: 'Prazo passou' }

// Ordem na lista: atrasadas primeiro, depois em dia, batidas e vencidas; dentro, pelo prazo mais perto.
export function ordenarMetas(lista) {
  const peso = { atras: 0, no_ritmo: 1, batida: 2, vencida: 3 }
  return [...lista].sort((a, b) => (peso[a.situacao?.estado] ?? 9) - (peso[b.situacao?.estado] ?? 9) || String(a.situacao?.fim).localeCompare(String(b.situacao?.fim)))
}

// Conta o progresso a partir das respostas e estudos (usado no servidor, puro para dar para testar).
// respostas: [{ dia, materia_id, segundos, revisao_id }]; estudos: Set de revisao_id concluídos;
// dominados: [{ materia_id }] (assuntos com estado dominado agora).
export function progressoDaMeta(meta, { respostas = [], estudosConcluidos = new Set(), dominados = [] }, hoje) {
  const daMateria = (x) => !meta.materia_id || x.materia_id === meta.materia_id
  if (meta.tipo === 'dominar') return dominados.filter(daMateria).length
  const { inicio, fim } = periodoDaMeta(meta, hoje)
  const noPeriodo = respostas.filter((r) => r.dia >= inicio && r.dia <= fim && daMateria(r))
  if (meta.tipo === 'questoes') return noPeriodo.length
  if (meta.tipo === 'minutos') return Math.floor(noPeriodo.reduce((s, r) => s + (r.segundos || 0), 0) / 60)
  return new Set(noPeriodo.filter((r) => estudosConcluidos.has(r.revisao_id)).map((r) => r.revisao_id)).size
}
