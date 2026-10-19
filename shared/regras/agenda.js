// Regras da Agenda: datas no horário de Brasília (semana começando no domingo), nomes em português,
// contagem regressiva, validação de um item, repetição semanal e o plano de estudo até a prova.
// Datas são textos 'AAAA-MM-DD' (o tipo date do Postgres). As contas usam meio-dia UTC, então mudança de horário
// e fuso do computador não mudam o dia.

export const TIPOS_EVENTO = [
  { id: 'prova', nome: 'Prova', descricao: 'Dia de prova. Dá para montar um plano de estudo até ela.' },
  { id: 'trabalho', nome: 'Trabalho', descricao: 'Entrega de trabalho ou apresentação.' },
  { id: 'tarefa', nome: 'Tarefa', descricao: 'Lição de casa ou algo para fazer.' },
  { id: 'estudo', nome: 'Estudo', descricao: 'Um horário marcado para estudar.' },
  { id: 'lembrete', nome: 'Lembrete', descricao: 'Algo para não esquecer.' },
  { id: 'pessoal', nome: 'Compromisso', descricao: 'Médico, viagem, aniversário.' },
]
export const NOME_TIPO = Object.fromEntries(TIPOS_EVENTO.map((t) => [t.id, t.nome]))
export const LIMITES_EVENTO = { titulo: 120, notas: 2000, assuntos: 30, duracaoMin: 5, duracaoMax: 600, semanas: 52 }
export const DURACOES = [15, 30, 45, 60, 90, 120, 180]

const FUSO = 'America/Sao_Paulo'
const DIA_MS = 86400000
const paraData = (dia) => new Date(`${dia}T12:00:00Z`)
const paraDia = (data) => data.toISOString().slice(0, 10)

// Dia de hoje em Brasília, como 'AAAA-MM-DD'.
export function diaDeHoje(agora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(agora).map((p) => [p.type, p.value]))
  return `${partes.year}-${partes.month}-${partes.day}`
}
// Dia (em Brasília) de um instante salvo pelo banco, como concluida_em.
export const diaDoInstante = (instante) => diaDeHoje(new Date(instante))

export function ehDia(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto ?? ''))) return false
  const data = paraData(texto)
  return !Number.isNaN(data.getTime()) && paraDia(data) === texto
}
export const somarDias = (dia, n) => paraDia(new Date(paraData(dia).getTime() + n * DIA_MS))
export const diferencaDias = (de, ate) => Math.round((paraData(ate) - paraData(de)) / DIA_MS)
export const diaDaSemana = (dia) => paraData(dia).getUTCDay()
export const inicioDaSemana = (dia) => somarDias(dia, -diaDaSemana(dia))
export const diasDaSemana = (dia) => Array.from({ length: 7 }, (_, i) => somarDias(inicioDaSemana(dia), i))
export const mesDoDia = (dia) => dia.slice(0, 7)
export function somarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}
export const ultimoDiaDoMes = (mes) => somarDias(`${somarMeses(mes, 1)}-01`, -1)

// Semanas inteiras (domingo a sábado) que cobrem o mês: 4 a 6 linhas de 7 dias.
export function gradeDoMes(mes) {
  const inicio = inicioDaSemana(`${mes}-01`)
  const fim = somarDias(inicioDaSemana(ultimoDiaDoMes(mes)), 6)
  const dias = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d)
  return dias
}

// Nomes em português ------------------------------------------------------------------------------------------------
export const NOMES_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const formato = (opcoes) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opcoes })
export const nomeDoMes = (mes) => maiuscula(formato({ month: 'long', year: 'numeric' }).format(paraData(`${mes}-01`)))
// "Quinta, 8 de outubro" (sem "-feira", que só ocupa espaço).
export const diaPorExtenso = (dia) => maiuscula(formato({ weekday: 'long', day: 'numeric', month: 'long' }).format(paraData(dia)).replace('-feira', ''))
// "8 de out."
export const diaCurto = (dia) => formato({ day: 'numeric', month: 'short' }).format(paraData(dia))

export function contagem(dia, hoje) {
  const n = diferencaDias(hoje, dia)
  if (n === 0) return 'hoje'
  if (n === 1) return 'amanhã'
  if (n === -1) return 'ontem'
  return n > 1 ? `faltam ${n} dias` : `há ${-n} dias`
}

// '14:30:00' vira '14h30'; '09:00' vira '9h'.
export function formatarHora(hora) {
  if (!hora) return ''
  const [h, m] = String(hora).split(':').map(Number)
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`
}
// 45 vira '45 min'; 90 vira '1h30'.
export function formatarDuracao(min) {
  if (!min) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h${m ? String(m).padStart(2, '0') : ''}`
}

// Validação e repetição --------------------------------------------------------------------------------------------
export function validarEvento(e) {
  const erros = {}
  const titulo = String(e.titulo ?? '').trim()
  if (!titulo) erros.titulo = 'Escreva um título.'
  else if (titulo.length > LIMITES_EVENTO.titulo) erros.titulo = `Use até ${LIMITES_EVENTO.titulo} letras no título.`
  if (!ehDia(e.data)) erros.data = 'Escolha uma data.'
  if (e.hora && !/^\d{2}:\d{2}(:\d{2})?$/.test(e.hora)) erros.hora = 'Use o formato 14:30.'
  if (e.duracao_min != null && (e.duracao_min < LIMITES_EVENTO.duracaoMin || e.duracao_min > LIMITES_EVENTO.duracaoMax)) erros.duracao = 'A duração vai de 5 minutos a 10 horas.'
  if (String(e.notas ?? '').length > LIMITES_EVENTO.notas) erros.notas = `Use até ${LIMITES_EVENTO.notas} letras nas notas.`
  if ((e.assuntos ?? []).length > LIMITES_EVENTO.assuntos) erros.assuntos = `Escolha até ${LIMITES_EVENTO.assuntos} assuntos.`
  if (e.repetirAte != null && e.repetirAte !== '') {
    if (!ehDia(e.repetirAte) || !ehDia(e.data) || e.repetirAte <= e.data) erros.repetirAte = 'Escolha um dia depois da primeira data.'
    else if (diferencaDias(e.data, e.repetirAte) > 7 * LIMITES_EVENTO.semanas) erros.repetirAte = 'Repita por até um ano.'
  }
  return erros
}

// Datas de "Repetir toda semana até": o primeiro dia e os mesmos dias da semana seguintes, até o fim (incluído).
export function datasDaSerie(inicio, ate, maximo = LIMITES_EVENTO.semanas + 1) {
  const datas = []
  for (let d = inicio; d <= ate && datas.length < maximo; d = somarDias(d, 7)) datas.push(d)
  return datas
}

const PESO_TIPO = { prova: 0, trabalho: 1, tarefa: 2, estudo: 3, lembrete: 4, pessoal: 5 }
// Por dia; no dia, primeiro os sem hora, depois por hora; empate: provas antes.
export function ordenarEventos(lista) {
  return [...lista].sort((a, b) => a.data.localeCompare(b.data)
    || String(a.hora ?? '').localeCompare(String(b.hora ?? ''))
    || (PESO_TIPO[a.tipo] ?? 9) - (PESO_TIPO[b.tipo] ?? 9)
    || String(a.titulo).localeCompare(String(b.titulo), 'pt-BR'))
}
// Texto curto para caber no calendário: na prova, a matéria; no plano, só os assuntos ou "Revisão geral".
export function rotuloCurto(e, nomeMateria = '') {
  if (e.tipo === 'prova' && nomeMateria) return nomeMateria
  if (e.origem === 'plano') return String(e.titulo).replace(/^Estudar /, '').replace(/ para .*$/, '')
  return e.titulo
}
export function agruparPorDia(lista) {
  const mapa = {}
  for (const e of ordenarEventos(lista)) (mapa[e.data] ??= []).push(e)
  return mapa
}

// Plano até a prova ------------------------------------------------------------------------------------------------
export const SESSOES_POR_SEMANA = { tranquilo: 2, normal: 3, focado: 5, obcecado: 6 }
export const MINUTOS_POR_SESSAO = { tranquilo: 25, normal: 40, focado: 50, obcecado: 60 }

// Quanto cada dia já está cheio: prova e trabalho pesam 2, o resto 1. Ignora o plano da própria prova e itens feitos.
export function ocupacaoDosDias(eventos, provaId = null) {
  const ocupacao = {}
  for (const e of eventos) {
    if (e.id === provaId || (provaId && e.plano_de === provaId) || e.concluido_em) continue
    ocupacao[e.data] = (ocupacao[e.data] ?? 0) + (e.tipo === 'prova' || e.tipo === 'trabalho' ? 2 : 1)
  }
  return ocupacao
}

// Escolhe n dias espalhados por igual, fugindo dos dias cheios quando há um livre por perto.
function espalhar(candidatos, n, ocupacao) {
  if (n <= 0) return []
  if (n >= candidatos.length) return [...candidatos]
  const usados = new Set()
  const passo = candidatos.length / n
  const raio = Math.max(1, Math.floor(passo / 2))
  for (let k = 0; k < n; k++) {
    const ideal = Math.min(candidatos.length - 1, Math.floor((k + 0.5) * passo))
    let melhor = -1
    let nota = Infinity
    for (let i = 0; i < candidatos.length; i++) {
      if (usados.has(i)) continue
      const distancia = Math.abs(i - ideal)
      const peso = (ocupacao[candidatos[i]] ?? 0) * 10 + distancia + (distancia > raio ? 100 : 0)
      if (peso < nota) {
        nota = peso
        melhor = i
      }
    }
    usados.add(melhor)
  }
  return [...usados].sort((a, b) => a - b).map((i) => candidatos[i])
}

// Divide a sequência em "partes" grupos de tamanhos quase iguais, sem repetir assunto dentro do mesmo grupo.
function dividir(sequencia, partes) {
  const grupos = []
  let inicio = 0
  for (let k = 0; k < partes; k++) {
    const tamanho = Math.floor(sequencia.length / partes) + (k < sequencia.length % partes ? 1 : 0)
    grupos.push([...new Set(sequencia.slice(inicio, inicio + tamanho))])
    inicio += tamanho
  }
  return grupos
}

const cortar = (texto) => (texto.length > LIMITES_EVENTO.titulo ? `${texto.slice(0, LIMITES_EVENTO.titulo - 3).trimEnd()}...` : texto)
function juntarNomes(nomes) {
  if (nomes.length <= 1) return nomes[0] ?? ''
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

// Sessões de estudo de hoje até a véspera da prova.
// - Quantas: as do ritmo por semana, e no mínimo duas para cada assunto mais a revisão final (até um estudo por dia).
// - Os últimos dias são revisão geral com todos os assuntos misturados (dois dias se houver 5 dias ou mais).
// - Dias cheios (prova, trabalho, vários itens) ficam livres quando há outro dia perto.
// assuntos: [{ id, nome }]. Devolve { sessoes: [{ data, titulo, assuntos: [id], duracao_min, final }], aviso }.
export function montarPlano({ prova, assuntos = [], hoje, ritmo = 'normal', ocupacao = {}, materiaNome = '' }) {
  if (!prova || !ehDia(prova.data) || prova.data <= hoje) return { sessoes: [], aviso: 'A prova é hoje ou já passou. Não há dias para um plano.' }
  const candidatos = []
  for (let d = hoje; d < prova.data; d = somarDias(d, 1)) candidatos.push(d)
  const porSemana = SESSOES_POR_SEMANA[ritmo] ?? SESSOES_POR_SEMANA.normal
  const minutos = MINUTOS_POR_SESSAO[ritmo] ?? MINUTOS_POR_SESSAO.normal
  const lista = assuntos.slice(0, LIMITES_EVENTO.assuntos)

  const finais = candidatos.length >= 5 ? 2 : 1
  const minimo = lista.length * 2 + finais
  const total = Math.min(candidatos.length, Math.max(Math.ceil((candidatos.length / 7) * porSemana), minimo))
  const nFinais = Math.min(finais, total)

  // Revisão geral: os dias menos cheios entre os últimos três (ou menos) antes da prova.
  const fimDaFila = candidatos.slice(-Math.min(candidatos.length, nFinais + 1))
  const diasFinais = [...fimDaFila].sort((a, b) => (ocupacao[a] ?? 0) - (ocupacao[b] ?? 0) || b.localeCompare(a)).slice(0, nFinais).sort()
  const resto = candidatos.filter((d) => d < diasFinais[0])
  const diasEstudo = espalhar(resto, total - nFinais, ocupacao)

  let grupos = []
  if (lista.length && diasEstudo.length) {
    const voltas = Math.max(2, Math.ceil(diasEstudo.length / lista.length))
    const sequencia = Array.from({ length: voltas }, () => lista).flat()
    grupos = diasEstudo.length >= lista.length * 2
      ? diasEstudo.map((_, i) => [sequencia[i]])
      : dividir(sequencia.slice(0, lista.length * 2), diasEstudo.length)
  }
  const nomeDe = (a) => a.nome
  const sessoes = diasEstudo.map((data, i) => {
    const grupo = grupos[i] ?? []
    const titulo = grupo.length ? `Estudar ${juntarNomes(grupo.map(nomeDe))}` : `Estudar ${materiaNome || prova.titulo}`.trim()
    return { data, titulo: cortar(titulo), assuntos: grupo.map((a) => a.id), duracao_min: minutos, final: false }
  })
  diasFinais.forEach((data, i) => {
    const titulo = i === diasFinais.length - 1 && diasFinais.length > 1 ? `Revisão final para ${prova.titulo}` : `Revisão geral para ${prova.titulo}`
    sessoes.push({ data, titulo: cortar(titulo), assuntos: lista.map((a) => a.id), duracao_min: Math.min(LIMITES_EVENTO.duracaoMax, minutos + 10), final: true })
  })
  sessoes.sort((a, b) => a.data.localeCompare(b.data))

  let aviso = null
  if (lista.length && diasEstudo.length < lista.length * 2) aviso = 'Pouco tempo até a prova: alguns dias juntam mais de um assunto.'
  return { sessoes, aviso }
}

// Progresso do plano de uma prova: estudos feitos, total e o próximo a fazer.
export function progressoDoPlano(eventos, provaId) {
  const plano = ordenarEventos(eventos.filter((e) => e.plano_de === provaId))
  return { total: plano.length, feitas: plano.filter((e) => e.concluido_em).length, proximo: plano.find((e) => !e.concluido_em) ?? null }
}

// A próxima prova a partir de hoje (inclusive), ou null.
export function proximaProva(eventos, hoje) {
  return ordenarEventos(eventos.filter((e) => e.tipo === 'prova' && e.data >= hoje && !e.concluido_em))[0] ?? null
}
