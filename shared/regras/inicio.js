// Regras do Início: qual é o próximo passo (uma ação só, a mais útil agora), datas da agenda no fuso de Brasília
// e a comparação da semana com a anterior.

const FUSO = 'America/Sao_Paulo'

// Data de hoje no fuso de Brasília, como 'AAAA-MM-DD'.
export function diaISO(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

const partes = (iso) => String(iso).slice(0, 10).split('-').map(Number)

export function somarDias(iso, n) {
  const [a, m, d] = partes(iso)
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10)
}

export function diasEntre(deISO, ateISO) {
  const [a1, m1, d1] = partes(deISO)
  const [a2, m2, d2] = partes(ateISO)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000)
}

// "Hoje", "Amanhã", "Em 5 dias" (ou "Já passou").
export function contagem(dataISO, hojeISO) {
  const n = diasEntre(hojeISO, dataISO)
  if (n < 0) return 'Já passou'
  if (n === 0) return 'Hoje'
  if (n === 1) return 'Amanhã'
  return `Em ${n} dias`
}

// Comparação com a semana anterior, para o selo de variação.
export function variacao(atual = 0, anterior = 0) {
  const d = atual - anterior
  if (!atual && !anterior) return { texto: 'Nada nas duas semanas', sentido: 0 }
  if (d === 0) return { texto: 'Igual à semana passada', sentido: 0 }
  return { texto: `${d > 0 ? '+' : ''}${d} que a semana passada`, sentido: Math.sign(d) }
}

// O próximo passo, nesta ordem: estudo pausado, revisões vencidas, assunto pronto para a prova de domínio, primeiro
// passo pendente (com ação), questões que faltam para a meta do dia e, por fim, "tudo feito".
// prontos: [{ id, nome }] dos assuntos em "Pronto para a prova de domínio".
export function proximoPasso({ estudo = {}, passos = null, meta = 20, prontos = [] } = {}) {
  // Prova com o relógio correndo vem antes de tudo.
  if (estudo?.prova_em_andamento) return { tipo: 'prova', prova: estudo.prova_em_andamento }
  if (estudo?.em_andamento) return { tipo: 'continuar', estudo: estudo.em_andamento }
  const vencidas = Number(estudo?.vencidas ?? 0)
  if (vencidas > 0) return { tipo: 'revisar', vencidas }
  if (prontos?.length) return { tipo: 'dominio', assunto: prontos[0], total: prontos.length }
  if (passos?.proximo?.acao) return { tipo: 'passo', passo: passos.proximo }
  const faltam = Math.max(0, meta - Number(estudo?.hoje ?? 0))
  if (faltam > 0) return { tipo: 'meta', faltam }
  return { tipo: 'feito' }
}
