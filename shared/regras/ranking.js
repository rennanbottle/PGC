// Regras do Ranking: a parte "Você" (acerto por período, nível, conquistas) e a parte "Geral" (pódio, linha da
// pessoa, períodos). Os números vêm de desempenho_resumo() e ranking_periodo() (migração 0014).
import { nivelPorPontos, pontosParaNivel } from './pontos.js'

// Acerto ponderado pelo número de respostas de cada semana. null quando não houve resposta.
export function acertoDe(semanas = []) {
  let soma = 0
  let n = 0
  for (const s of semanas) {
    const r = Number(s?.respondidas ?? 0)
    if (r > 0 && s.acerto != null) {
      soma += Number(s.acerto) * r
      n += r
    }
  }
  return n ? Math.round(soma / n) : null
}

// Últimas 4 semanas contra as 4 anteriores (a lista vem da mais antiga para a atual).
export function comparacaoAcerto(semanas = []) {
  const atual = acertoDe(semanas.slice(-4))
  const anterior = acertoDe(semanas.slice(-8, -4))
  return { atual, anterior, diferenca: atual != null && anterior != null ? atual - anterior : null }
}

// Série do minigráfico de acerto: só as semanas com respostas (semana sem resposta não é 0%).
export const serieAcerto = (semanas = []) =>
  semanas.filter((s) => Number(s?.respondidas) > 0 && s.acerto != null).map((s) => Number(s.acerto))

// Pontos da semana atual contra a anterior (semanas da mais antiga para a atual).
export function comparacaoPontos(semanas = []) {
  const atual = Number(semanas.at(-1)?.pontos ?? 0)
  const anterior = semanas.length > 1 ? Number(semanas.at(-2)?.pontos ?? 0) : null
  return { atual, anterior, diferenca: anterior == null ? null : atual - anterior }
}

// "28/9" a partir de "2026-09-28".
export function diaMes(data) {
  const [, m, d] = String(data ?? '').split('-')
  return m && d ? `${Number(d)}/${Number(m)}` : ''
}

// Dias com pelo menos uma resposta numa lista [{ data, n }].
export const diasComEstudo = (porDia = []) => porDia.filter((d) => Number(d?.n) > 0).length

// Onde a pessoa está no nível: pontos feitos dentro do nível e quanto falta para o próximo.
export function progressoNivel(pontos = 0) {
  const p = Math.max(0, Number(pontos) || 0)
  const nivel = nivelPorPontos(p)
  const base = pontosParaNivel(nivel)
  const proximo = pontosParaNivel(nivel + 1)
  const total = proximo - base
  const feito = p - base
  return { nivel, base, proximo, feito, total, falta: Math.max(0, proximo - p), fracao: total ? Math.min(1, feito / total) : 0 }
}

// Situação dos assuntos, do melhor estado para o começo (ordem da barra empilhada).
export const ESTADOS_PROFICIENCIA = [
  { estado: 'dominado', nome: 'Dominado' },
  { estado: 'pronto_para_prova', nome: 'Pronto para a prova' },
  { estado: 'proficiente', nome: 'Proficiente' },
  { estado: 'em_desenvolvimento', nome: 'Em desenvolvimento' },
  { estado: 'relembrar', nome: 'Precisa relembrar' },
  { estado: 'com_dificuldade', nome: 'Com dificuldade' },
  { estado: 'iniciando', nome: 'Iniciando' },
  { estado: 'nao_iniciado', nome: 'Não iniciado' },
]

// { dominado: 1, iniciando: 4 } vira os pedaços da barra (só os que existem), com a fração de cada um.
export function segmentosProficiencia(mapa = {}) {
  const todos = ESTADOS_PROFICIENCIA.map((e) => ({ ...e, n: Math.max(0, Number(mapa?.[e.estado] ?? 0) || 0) }))
  const total = todos.reduce((s, x) => s + x.n, 0)
  return { total, segmentos: todos.filter((s) => s.n > 0).map((s) => ({ ...s, fracao: s.n / total })) }
}

// Conquistas calculadas no navegador. "valor" lê os dados juntados em conquistas().
export const CONQUISTAS = [
  { id: 'primeiro_estudo', nome: 'Primeiro estudo', descricao: 'Terminar um estudo até a última questão.', meta: 1, valor: (d) => d.sessoes },
  { id: 'dez_estudos', nome: '10 estudos', descricao: 'Terminar 10 estudos.', meta: 10, valor: (d) => d.sessoes },
  { id: 'cem_questoes', nome: '100 questões', descricao: 'Responder 100 questões.', meta: 100, valor: (d) => d.respondidas },
  { id: 'mil_questoes', nome: '1.000 questões', descricao: 'Responder mil questões.', meta: 1000, valor: (d) => d.respondidas },
  { id: 'sete_dias', nome: '7 dias seguidos', descricao: 'Estudar 7 dias sem parar.', meta: 7, valor: (d) => d.melhorSequencia },
  { id: 'trinta_dias', nome: '30 dias de estudo', descricao: 'Estudar em 30 dias diferentes.', meta: 30, valor: (d) => d.diasEstudados },
  { id: 'semana_afiada', nome: 'Semana afiada', descricao: '80% de acerto numa semana com 20 questões ou mais.', meta: 1, valor: (d) => d.semanasAfiadas },
  { id: 'primeiro_dominado', nome: 'Assunto dominado', descricao: 'Passar na prova de domínio de um assunto.', meta: 1, valor: (d) => d.dominados },
  { id: 'nivel_5', nome: 'Nível 5', descricao: 'Chegar ao nível 5 da conta.', meta: 5, valor: (d) => d.nivel },
]

export function conquistas(desempenho = {}, estudo = {}) {
  const t = desempenho?.totais ?? {}
  const dados = {
    sessoes: Math.max(Number(t.sessoes ?? 0), Number(estudo?.revisoes_concluidas ?? 0)),
    respondidas: Math.max(Number(t.respondidas ?? 0), Number(estudo?.respondidas ?? 0)),
    melhorSequencia: Number(t.melhor_sequencia ?? 0),
    diasEstudados: Number(t.dias_estudados ?? 0),
    semanasAfiadas: (desempenho?.semanas ?? []).filter((s) => Number(s.respondidas) >= 20 && Number(s.acerto) >= 80).length,
    dominados: Math.max(Number(desempenho?.proficiencias?.dominado ?? 0), Number(estudo?.dominados ?? 0)),
    nivel: nivelPorPontos(Number(estudo?.pontos ?? t.pontos ?? 0)),
  }
  return CONQUISTAS.map(({ valor, ...c }) => {
    const atual = Math.max(0, Number(valor(dados)) || 0)
    return { ...c, atual: Math.min(atual, c.meta), ganha: atual >= c.meta }
  })
}

// Conquistas ganhas que ainda não foram comemoradas (a tela guarda as vistas no navegador).
export function conquistasNovas(lista = [], vistas = []) {
  const ja = new Set(vistas)
  return lista.filter((c) => c.ganha && !ja.has(c.id)).map((c) => c.id)
}

// Pódio: os três primeiros da lista na ordem de exibição (2º, 1º, 3º), com a altura de cada degrau.
// Empates (mesma posição) ficam com a mesma altura.
export function podio(lista = []) {
  const ALTURA = { 1: 1, 2: 0.74, 3: 0.56 }
  const top = lista.slice(0, 3)
  const ordem = top.length === 3 ? [top[1], top[0], top[2]] : top.length === 2 ? [top[1], top[0]] : top
  return ordem.map((l) => ({ ...l, altura: ALTURA[l.posicao] ?? 0.5 }))
}

// A linha da pessoa fica presa embaixo da lista quando ela não aparece entre as mostradas.
export function minhaLinhaFora(lista = [], eu = null, mostradas = 10) {
  if (!eu?.posicao) return null
  if (lista.slice(0, mostradas).some((l) => l.eu)) return null
  return { posicao: eu.posicao, pontos: Number(eu.pontos ?? 0) }
}

// Lugar que a pessoa teria com estes pontos (para quem ainda não participa). Empate divide o lugar.
export function posicaoSe(lista = [], pontos = 0) {
  return lista.filter((l) => !l.eu && Number(l.pontos) > Number(pontos)).length + 1
}

export const PERIODOS = [
  { valor: 'semana', texto: 'Semana', desde: 'Desde segunda-feira' },
  { valor: 'mes', texto: 'Mês', desde: 'Desde o dia 1' },
  { valor: 'geral', texto: 'Geral', desde: 'Desde o começo' },
]
export const periodoValido = (p) => (PERIODOS.some((x) => x.valor === p) ? p : 'semana')
