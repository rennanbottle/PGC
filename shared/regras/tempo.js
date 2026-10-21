// Datas escritas do jeito que se fala ("há 5 minutos", "ontem", "há 3 dias"), no horário de Brasília.

const FUSO = 'America/Sao_Paulo'

// Número do dia no calendário de Brasília (para comparar "hoje", "ontem"...).
function diaNoFuso(data) {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(data)
    .split('-')
    .map(Number)
  return Date.UTC(ano, mes - 1, dia) / 86400000
}

export function tempoRelativo(quando, agora = new Date()) {
  const data = new Date(quando)
  if (Number.isNaN(data.getTime())) return ''
  const segundos = Math.max(0, (agora - data) / 1000)
  if (segundos < 60) return 'agora há pouco'
  if (segundos < 3600) {
    const m = Math.floor(segundos / 60)
    return `há ${m} ${m === 1 ? 'minuto' : 'minutos'}`
  }
  const dias = diaNoFuso(agora) - diaNoFuso(data)
  if (dias <= 0) {
    const h = Math.floor(segundos / 3600)
    return `há ${h} ${h === 1 ? 'hora' : 'horas'}`
  }
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return `em ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: FUSO }).format(data)}`
}

// Quantidades por dia nos últimos "dias" (o último é hoje), para o minigráfico,
// e a soma do período anterior de mesmo tamanho, para a comparação.
export function serieDiaria(datas, dias = 7, agora = new Date()) {
  const hoje = diaNoFuso(agora)
  const serie = Array(dias).fill(0)
  let anterior = 0
  for (const quando of datas) {
    const d = new Date(quando)
    if (Number.isNaN(d.getTime())) continue
    const atras = hoje - diaNoFuso(d)
    if (atras >= 0 && atras < dias) serie[dias - 1 - atras] += 1
    else if (atras >= dias && atras < dias * 2) anterior += 1
  }
  return { serie, total: serie.reduce((s, n) => s + n, 0), anterior }
}
