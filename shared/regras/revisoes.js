// Montar uma revisão (Motor de estudo, seção 8): modelos recomendados, leitura da configuração, níveis por posição
// (fixa, curva, aleatória, distribuir, adaptativa), escolha das questões e ordem, tempo estimado e o resumo do
// resultado. Funções puras: o servidor busca as candidatas no banco e chama estas regras.
import { distribuir } from './gerar.js'
import { probabilidade } from './proficiencia.js'
import { RITMOS, RITMO_PADRAO } from './ritmo.js'
import { TIPOS } from './questoes.js'

export const MAX_REVISAO = 60
const TODOS_TIPOS = TIPOS.map((t) => t.id)
export const TIPOS_REVISAO_PADRAO = TODOS_TIPOS.filter((t) => t !== 'cartao')
const ESCOLHA_RAPIDA = ['multipla_escolha', 'certo_errado', 'verdadeiro_falso', 'lacuna_opcoes', 'prever_resultado', 'texto_base']
const ESCRITA_ANALISE = ['numerica', 'encontrar_erro', 'assercao_razao', 'verdadeiro_falso', 'texto_base', 'lacuna_digitada', 'multipla_escolha', 'multipla_resposta', 'resposta_curta']
const ANALISE = ['encontrar_erro', 'assercao_razao', 'multipla_resposta', 'texto_base', 'numerica', 'prever_resultado']

export const ORIGENS_REVISAO = [
  { id: 'banco', nome: 'Vencidas e novas do banco', descricao: 'Primeiro as que venceram hoje, depois as que você nunca respondeu.' },
  { id: 'erradas', nome: 'Só as que errei', descricao: 'Erradas nos últimos 14 dias.' },
  { id: 'importadas', nome: 'Só importadas', descricao: 'Provas antigas, listas e Enem.' },
]

const base = (ritmo) => ({
  origem: 'banco',
  completarMaterial: true,
  completarIa: false,
  quantidade: 20,
  dificuldade: { modo: 'fixa', nivel: (RITMOS[ritmo] ?? RITMOS[RITMO_PADRAO]).nivelPadrao, de: 2, ate: 3, forma: 'crescente', niveis: [2, 3], contas: { 1: 0, 2: 8, 3: 12, 4: 0, 5: 0 } },
  tipos: [...TIPOS_REVISAO_PADRAO],
  ordem: 'intercalada',
  nivelNaQuestao: 'mostrar',
  dicas: 3,
  formulario: true,
  cronometro: { modo: 'sem', minutos: 25, segundos: 90 },
  correcao: 'cada',
  avancar: false,
})

export const configBase = (ritmo) => base(ritmo)
export const GRUPOS_TIPOS = { ESCOLHA_RAPIDA, ESCRITA_ANALISE, ANALISE }

export const MODELOS_REVISAO = [
  { id: 'revisao_do_dia', nome: 'Revisão do dia', descricao: 'As vencidas hoje e novas do banco, no nível do seu ritmo.', config: () => ({}) },
  { id: 'reforco_erros', nome: 'Reforço dos erros', descricao: 'As que você errou em 14 dias, para tentar de novo.', config: () => ({ origem: 'erradas', quantidade: 15 }) },
  { id: 'estudo_serio', nome: 'Estudo sério', descricao: '20 questões de escrita e análise, subindo de nível.', config: (r) => ({ quantidade: 20, tipos: ESCRITA_ANALISE, dificuldade: { ...base(r).dificuldade, modo: 'curva', de: (RITMOS[r] ?? RITMOS[RITMO_PADRAO]).nivelPadrao, ate: Math.min(3, (RITMOS[r] ?? RITMOS[RITMO_PADRAO]).nivelPadrao + 1), forma: 'crescente' } }) },
  { id: 'rapida', nome: 'Rápida', descricao: '6 questões de escolha, sem cronômetro.', config: () => ({ quantidade: 6, tipos: ESCOLHA_RAPIDA, completarMaterial: false }) },
  { id: 'desafio', nome: 'Desafio', descricao: 'Muito difícil, sem dica, tipos de análise.', config: () => ({ quantidade: 10, tipos: ANALISE, dicas: 0, dificuldade: { ...base().dificuldade, modo: 'fixa', nivel: 4 } }) },
  { id: 'intercalada', nome: 'Intercalada', descricao: '3 ou mais assuntos misturados, uma questão de cada vez.', config: () => ({ quantidade: 18, ordem: 'intercalada' }) },
  { id: 'pre_prova', nome: 'Pré-prova', descricao: 'Assuntos da prova marcada, com peso nos mais fracos.', config: () => ({}) },
  { id: 'personalizada', nome: 'Personalizada', descricao: 'Tudo editável, inclusive completar com IA.', config: () => ({}) },
]
export const MODELO_REVISAO = Object.fromEntries(MODELOS_REVISAO.map((m) => [m.id, m]))

export function configDoModelo(id, ritmo = RITMO_PADRAO) {
  const m = MODELO_REVISAO[id] ?? MODELO_REVISAO.personalizada
  return { modelo: m.id, ...base(ritmo), ...m.config(ritmo) }
}

// Situação de cada modelo para a tela Revisar: se está disponível, se é recomendado e por quê.
// ctx: { vencidas, erros14, assuntoMaisErrado: { nome, erros }, proficientes, pertoDeProficiente: { nome, proficiencia, meta }, muitoDificilLiberado, ritmo }
export function situacaoDosModelos(ctx) {
  const r = ctx.ritmo ?? RITMO_PADRAO
  return MODELOS_REVISAO.map((m) => {
    let disponivel = true
    let recomendado = false
    let motivo = ''
    switch (m.id) {
      case 'revisao_do_dia':
        recomendado = ctx.vencidas > 0
        motivo = ctx.vencidas ? `Recomendado: ${ctx.vencidas} ${ctx.vencidas === 1 ? 'questão venceu' : 'questões venceram'} hoje.` : 'Nenhuma vencida hoje: entram as novas do banco.'
        break
      case 'reforco_erros':
        disponivel = ctx.erros14 > 0
        recomendado = ctx.erros14 >= 5
        motivo = !ctx.erros14 ? 'Nenhum erro nos últimos 14 dias.' : recomendado && ctx.assuntoMaisErrado ? `Recomendado: ${ctx.assuntoMaisErrado.erros} erros em ${ctx.assuntoMaisErrado.nome} em 14 dias.` : `${ctx.erros14} ${ctx.erros14 === 1 ? 'erro' : 'erros'} nos últimos 14 dias.`
        break
      case 'estudo_serio':
        motivo = `Padrão do ritmo ${(RITMOS[r] ?? RITMOS[RITMO_PADRAO]).nome ?? r}.`
        recomendado = !ctx.vencidas && r !== 'tranquilo'
        break
      case 'rapida':
        motivo = 'Para quando sobram poucos minutos.'
        break
      case 'desafio':
        disponivel = !!ctx.muitoDificilLiberado
        motivo = disponivel ? 'Para quem já tem um assunto proficiente.' : ctx.pertoDeProficiente ? `Abre quando um assunto fica proficiente. ${ctx.pertoDeProficiente.nome} está em ${ctx.pertoDeProficiente.proficiencia} de ${ctx.pertoDeProficiente.meta}.` : 'Abre quando um assunto fica proficiente.'
        break
      case 'intercalada':
        disponivel = ctx.proficientes >= 3
        motivo = disponivel ? 'Vários assuntos proficientes: misturar ajuda a lembrar.' : `Abre com 3 assuntos proficientes. Você tem ${ctx.proficientes ?? 0}.`
        recomendado = disponivel
        break
      case 'pre_prova':
        disponivel = false
        motivo = 'Marque uma prova na Agenda para usar. A Agenda chega numa próxima etapa.'
        break
      default:
        motivo = 'Sempre disponível.'
    }
    return { id: m.id, nome: m.nome, descricao: m.descricao, podeUsarIa: m.id === 'personalizada', disponivel, recomendado: disponivel && recomendado, motivo }
  })
}

// ---------- Configuração enviada ----------
// Origens das questões. As três primeiras vêm da revisão avulsa; as outras, dos blocos de um conjunto:
// revisao = já respondidas (vencidas primeiro), pratica = nunca respondidas, pratica_importadas = nunca respondidas
// e importadas, erros_conjunto = as que a pessoa errar nos blocos anteriores (o bloco é montado na hora).
export const ORIGENS_VALIDAS = ['banco', 'erradas', 'importadas', 'revisao', 'pratica', 'pratica_importadas', 'erros_conjunto']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const inteiro = (v, min, max, padrao) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao
}

// libera: { muitoDificil, impossivel, disfarcar }
export function lerConfigRevisao(corpo, libera = {}) {
  const c = corpo && typeof corpo === 'object' ? corpo : {}
  const maxNivel = libera.impossivel ? 5 : libera.muitoDificil ? 4 : 3
  const vistos = new Set()
  const assuntos = (Array.isArray(c.assuntos) ? c.assuntos : [])
    .filter((a) => UUID.test(a?.id ?? '') && !vistos.has(a.id) && vistos.add(a.id))
    .slice(0, 60)
    .map((a) => ({ id: a.id, peso: inteiro(a.peso, 0, 100, 0) }))
  if (!assuntos.length) return { erro: 'Escolha pelo menos um assunto.' }
  if (assuntos.every((a) => !a.peso)) assuntos.forEach((a) => (a.peso = 1))
  const tipos = [...new Set((Array.isArray(c.tipos) ? c.tipos : []).filter((t) => TODOS_TIPOS.includes(t)))]
  if (!tipos.length) return { erro: 'Escolha pelo menos um tipo de questão.' }
  const d = c.dificuldade ?? {}
  const modo = ['fixa', 'curva', 'aleatoria', 'distribuir', 'adaptativa'].includes(d.modo) ? d.modo : 'fixa'
  const nv = (v, p) => inteiro(v, 1, maxNivel, Math.min(p, maxNivel))
  const dificuldade = {
    modo,
    nivel: nv(d.nivel, 2),
    de: nv(d.de, 2),
    ate: nv(d.ate, 3),
    forma: ['crescente', 'decrescente', 'ondas', 'misturada'].includes(d.forma) ? d.forma : 'crescente',
    niveis: [...new Set((Array.isArray(d.niveis) ? d.niveis : []).map(Number).filter((n) => n >= 1 && n <= maxNivel))],
    contas: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, n <= maxNivel ? inteiro(d.contas?.[n], 0, MAX_REVISAO, 0) : 0])),
  }
  if (modo === 'aleatoria' && !dificuldade.niveis.length) return { erro: 'Marque pelo menos um nível para sortear.' }
  let quantidade = inteiro(c.quantidade, 1, MAX_REVISAO, 20)
  if (modo === 'distribuir') {
    const soma = Object.values(dificuldade.contas).reduce((s, n) => s + n, 0)
    if (!soma) return { erro: 'Distribua as questões entre os níveis.' }
    quantidade = Math.min(MAX_REVISAO, soma)
  }
  const cron = c.cronometro ?? {}
  return {
    config: {
      modelo: MODELO_REVISAO[c.modelo] ? c.modelo : 'personalizada',
      assuntos,
      origem: ORIGENS_VALIDAS.includes(c.origem) ? c.origem : 'banco',
      completarMaterial: c.completarMaterial === true,
      completarIa: c.completarIa === true,
      quantidade,
      dificuldade,
      tipos,
      ordem: c.ordem === 'assunto' ? 'assunto' : 'intercalada',
      nivelNaQuestao: c.nivelNaQuestao === 'esconder' ? 'esconder' : c.nivelNaQuestao === 'disfarcar' && libera.disfarcar ? 'disfarcar' : 'mostrar',
      dicas: inteiro(c.dicas, 0, 3, 3) > 0 ? 3 : 0, // conforme o nível (sessao.maxDicasDoNivel) ou desligadas
      formulario: c.formulario !== false,
      cronometro: {
        modo: cron.modo === 'bloco' ? 'sessao' : ['sem', 'sessao', 'questao'].includes(cron.modo) ? cron.modo : 'sem', // sessao = o bloco inteiro
        minutos: inteiro(cron.minutos, 1, 240, 25),
        segundos: inteiro(cron.segundos, 10, 900, 90),
      },
      correcao: ['fim', 'bloco'].includes(c.correcao) ? c.correcao : 'cada',
      avancar: c.avancar === true,
    },
  }
}

// ---------- Níveis por posição ----------
// Devolve o nível alvo de cada posição (null na adaptativa, que escolhe pela chance prevista de 70%).
export function niveisAlvo(dificuldade, n, rng = Math.random) {
  const d = dificuldade
  if (d.modo === 'adaptativa') return Array(n).fill(null)
  if (d.modo === 'fixa') return Array(n).fill(d.nivel)
  if (d.modo === 'aleatoria') return Array.from({ length: n }, () => d.niveis[Math.floor(rng() * d.niveis.length)])
  if (d.modo === 'distribuir') {
    const contas = [1, 2, 3, 4, 5].map((k) => d.contas[k] ?? 0)
    const partes = distribuir(n, contas)
    const lista = partes.flatMap((q, i) => Array(q).fill(i + 1))
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
    }
    return lista
  }
  // Curva entre "de" e "ate".
  const lo = Math.min(d.de, d.ate)
  const hi = Math.max(d.de, d.ate)
  const t = (i) => (n === 1 ? 0 : i / (n - 1))
  return Array.from({ length: n }, (_, i) => {
    if (d.forma === 'decrescente') return Math.round(hi - (hi - lo) * t(i))
    if (d.forma === 'ondas') return Math.round(lo + (hi - lo) * (1 - Math.cos(2 * Math.PI * t(i) * 2)) / 2)
    if (d.forma === 'misturada') return lo + Math.floor(rng() * (hi - lo + 1))
    return Math.round(lo + (hi - lo) * t(i))
  })
}

// ---------- Escolher as questões ----------
// candidatas: { id, assunto_id, tipo, nivel, b, vencida, nova, errada, importada, recente }
// thetas: { [assuntoId]: theta } para a adaptativa. excluir: ids que já estão em outro bloco do conjunto.
// Devolve { itens, faltam: { [assuntoId]: n }, disponiveis, excluidas }.
export const passaNaOrigem = (q, origem) => {
  switch (origem) {
    case 'erradas': case 'erros_conjunto': return !!q.errada
    case 'importadas': return !!q.importada
    case 'revisao': return !q.nova
    case 'pratica': return !!q.nova
    case 'pratica_importadas': return !!q.nova && !!q.importada
    default: return true
  }
}
export function escolherQuestoes(candidatas, config, { rng = Math.random, thetas = {}, preencherComOutros = true, excluir = null } = {}) {
  const n = config.quantidade
  const marcados = config.assuntos.filter((a) => a.peso > 0)
  const tipos = new Set(config.tipos)
  const filtro = (q) => tipos.has(q.tipo)
    && marcados.some((a) => a.id === q.assunto_id)
    && passaNaOrigem(q, config.origem)
  const antes = candidatas.filter(filtro)
  const pool = excluir?.size ? antes.filter((q) => !excluir.has(q.id)) : antes

  // Quantas de cada assunto e em que posição (intercalada: espalha pelo peso; por assunto: em blocos).
  const cotas = distribuir(n, marcados.map((a) => a.peso))
  const sequencia = []
  if (config.ordem === 'assunto') marcados.forEach((a, i) => sequencia.push(...Array(cotas[i]).fill(a.id)))
  else {
    const usados = marcados.map(() => 0)
    for (let k = 0; k < n; k++) {
      let melhor = -1
      let menor = Infinity
      marcados.forEach((_, i) => {
        if (usados[i] >= cotas[i]) return
        const razao = (usados[i] + 0.5) / cotas[i]
        if (razao < menor) {
          menor = razao
          melhor = i
        }
      })
      usados[melhor]++
      sequencia.push(marcados[melhor].id)
    }
  }
  const alvos = niveisAlvo(config.dificuldade, n, rng)
  const usadas = new Set()
  const nota = (q, alvo) => {
    const prioridade = q.vencida ? 0 : q.nova ? 1 : 2
    const distancia = alvo == null
      ? Math.abs(probabilidade(thetas[q.assunto_id] ?? 0, q.b ?? 0) - 0.7) * 6
      : Math.abs((q.nivel ?? 2) - alvo)
    return prioridade * 4 + distancia * 3 + (q.recente ? 40 : 0) + rng() * 0.5
  }
  const escolher = (lista, alvo) => {
    let melhor = null
    let menor = Infinity
    for (const q of lista) {
      if (usadas.has(q.id)) continue
      const v = nota(q, alvo)
      if (v < menor) {
        menor = v
        melhor = q
      }
    }
    return melhor
  }
  const vagas = sequencia.map((assunto, i) => {
    const q = escolher(pool.filter((x) => x.assunto_id === assunto), alvos[i])
    if (q) usadas.add(q.id)
    return q
  })
  const faltam = {}
  vagas.forEach((q, i) => {
    if (!q) faltam[sequencia[i]] = (faltam[sequencia[i]] ?? 0) + 1
  })
  if (preencherComOutros) {
    vagas.forEach((q, i) => {
      if (q) return
      const outra = escolher(pool, alvos[i])
      if (outra) {
        usadas.add(outra.id)
        vagas[i] = outra
      }
    })
  }
  return { itens: separarTipos(vagas.filter(Boolean)), faltam, disponiveis: pool.length, excluidas: antes.length - pool.length }
}

// Nunca 3 do mesmo tipo seguidas: troca com a próxima de tipo diferente.
export function separarTipos(itens) {
  const lista = [...itens]
  for (let i = 2; i < lista.length; i++) {
    if (lista[i].tipo === lista[i - 1].tipo && lista[i].tipo === lista[i - 2].tipo) {
      const j = lista.findIndex((q, k) => k > i && q.tipo !== lista[i].tipo)
      if (j > 0) [lista[i], lista[j]] = [lista[j], lista[i]]
    }
  }
  return lista
}

// ---------- Tempo e nível mostrado ----------
const SEGUNDOS_TIPO = { multipla_escolha: 50, multipla_resposta: 70, verdadeiro_falso: 60, certo_errado: 30, assercao_razao: 70, lacuna_opcoes: 40, lacuna_digitada: 40, associar: 80, ordenar: 70, classificar: 80, numerica: 120, encontrar_erro: 90, texto_base: 110, prever_resultado: 70, cartao: 30, resposta_curta: 120, explicar: 180 }
const FATOR_NIVEL = { 1: 0.8, 2: 1, 3: 1.3, 4: 1.6, 5: 2 }
export function minutosEstimados(itens) {
  const s = itens.reduce((t, q) => t + (SEGUNDOS_TIPO[q.tipo] ?? 60) * (FATOR_NIVEL[q.nivel] ?? 1), 0)
  return Math.max(1, Math.round(s / 60))
}

// Esconder: nenhum rótulo. Disfarçar: em 3 de cada 10 questões o rótulo mostra um nível vizinho.
export function nivelMostrado(modo, nivel, rng = Math.random) {
  if (modo === 'esconder') return null
  if (modo === 'disfarcar' && rng() < 0.3) return nivel <= 1 ? 2 : nivel >= 5 ? 4 : nivel + (rng() < 0.5 ? -1 : 1)
  return nivel
}

// ---------- Resultado ----------
// itens respondidos: { tipo, nivel, bloom, assunto_id, resultado, incerta }
export function resumoDoResultado(itens) {
  const conta = (lista) => ({
    total: lista.length,
    certas: lista.filter((i) => i.resultado === 'correta').length,
    parciais: lista.filter((i) => i.resultado === 'parcial').length,
    erradas: lista.filter((i) => i.resultado === 'incorreta').length,
    branco: lista.filter((i) => !i.resultado).length,
  })
  const agrupar = (chave) => {
    const g = new Map()
    for (const i of itens) {
      const k = i[chave] ?? 'sem'
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(i)
    }
    return [...g.entries()].map(([k, lista]) => ({ chave: k, ...conta(lista) }))
  }
  return {
    ...conta(itens),
    incertas: itens.filter((i) => i.incerta && i.resultado === 'correta').length,
    porTipo: agrupar('tipo').sort((a, b) => b.total - a.total),
    porNivel: agrupar('nivel').sort((a, b) => a.chave - b.chave),
    porBloom: agrupar('bloom').sort((a, b) => a.chave - b.chave),
    porAssunto: agrupar('assunto_id'),
  }
}

// Nota FSRS de uma resposta: errou 1, parcial ou com dica 2, acertou 3.
// Certa marcada como incerta conta como "difícil" no FSRS: a questão volta mais cedo, sem perder pontos.
export function notaDaResposta(resultado, dicas = 0, incerta = false) {
  if (resultado === 'incorreta' || !resultado) return 1
  if (resultado === 'parcial' || dicas > 0 || incerta) return 2
  return 3
}

// Dia de estudo no horário de Brasília (número de dias desde 1970), para o FSRS e para os dias seguidos.
export function diaDeBrasilia(data = new Date()) {
  return Math.floor((new Date(data).getTime() - 3 * 3600 * 1000) / 86400000)
}
export const dataDoDia = (dia) => new Date(dia * 86400000).toISOString().slice(0, 10)
