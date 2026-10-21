// Conjuntos de estudo (matriz de 06/10): um estudo com nome, em blocos de Revisão e Prática que rodam em sequência.
//   - Revisão volta no que a pessoa já respondeu (vencidas primeiro, ou só as erradas, ou as que ela errar nos
//     blocos anteriores do próprio conjunto).
//   - Prática traz questões que ela ainda não respondeu (do banco; se faltar, do material e da IA).
//   - Por padrão nenhuma questão aparece em dois blocos; um bloco pode permitir repetir.
//   - O conjunto salvo é só o modelo. Cada vez que a pessoa começa, vira uma execução com cópia dos blocos.
// Funções puras: o servidor e as telas usam as mesmas.
import { GRUPOS_TIPOS, TIPOS_REVISAO_PADRAO, configBase, escolherQuestoes, lerConfigRevisao, minutosEstimados } from './revisoes.js'
import { sorteador } from './sessao.js'
import { RITMOS, RITMO_PADRAO } from './ritmo.js'
import { nomeDoNivel } from './questoes.js'

export const MAX_BLOCOS = 6
export const MAX_CONJUNTO = 60
export const MAX_NOME_CONJUNTO = 80
export const MAX_NOME_BLOCO = 60

export const TIPOS_BLOCO = {
  revisao: { nome: 'Revisão', descricao: 'Volta no que você já respondeu.' },
  pratica: { nome: 'Prática', descricao: 'Traz questões que você ainda não viu.' },
}
export const ORIGENS_BLOCO = {
  revisao: [
    { id: 'vencidas', nome: 'Vencidas primeiro', descricao: 'As que venceram hoje e, depois, as que você respondeu há mais tempo.' },
    { id: 'erradas', nome: 'Erradas em 14 dias', descricao: 'Só as que você errou nos últimos 14 dias.' },
    { id: 'erros_conjunto', nome: 'Erros deste conjunto', descricao: 'As que você errar nos blocos anteriores. Se forem poucas, completa com erradas dos últimos 14 dias.' },
  ],
  pratica: [
    { id: 'novas', nome: 'Novas do banco', descricao: 'Questões que você ainda não respondeu.' },
    { id: 'importadas', nome: 'Só importadas', descricao: 'Listas, provas antigas e Enem que você ainda não respondeu.' },
  ],
}
export const CORRECOES = [['cada', 'A cada questão'], ['bloco', 'No fim do bloco'], ['fim', 'No fim do conjunto']]

// Origem do bloco para o sorteio em revisoes.escolherQuestoes.
export function origemDoSorteio(bloco) {
  if (bloco.tipo === 'pratica') return bloco.origem === 'importadas' ? 'pratica_importadas' : 'pratica'
  if (bloco.origem === 'erradas') return 'erradas'
  if (bloco.origem === 'erros_conjunto') return 'erros_conjunto'
  return 'revisao'
}

const ritmoDe = (r) => RITMOS[r] ?? RITMOS[RITMO_PADRAO]

export function blocoPadrao(tipo = 'revisao', ritmo = RITMO_PADRAO, extra = {}) {
  const b = configBase(ritmo)
  const comum = {
    assuntos: [],
    quantidade: b.quantidade,
    dificuldade: b.dificuldade,
    tipos: [...TIPOS_REVISAO_PADRAO],
    ordem: 'intercalada',
    nivelNaQuestao: 'mostrar',
    dicas: 3,
    formulario: true,
    cronometro: { modo: 'sem', minutos: 25, segundos: 90 },
    avancar: false,
    repetir: false,
  }
  const proprio = tipo === 'pratica'
    ? { tipo: 'pratica', nome: 'Prática', origem: 'novas', completarNovas: false, completarMaterial: true, completarIa: false, correcao: 'cada', quantidade: 10 }
    : { tipo: 'revisao', nome: 'Revisão', origem: 'vencidas', completarNovas: true, completarMaterial: false, completarIa: false, correcao: 'cada', quantidade: 10 }
  return JSON.parse(JSON.stringify({ ...comum, ...proprio, ...extra }))
}

// ---------- Receitas (pontos de partida) ----------
const curvaSobe = (r) => {
  const n = ritmoDe(r).nivelPadrao
  return { ...configBase(r).dificuldade, modo: 'curva', de: n, ate: Math.min(3, n + 1), forma: 'crescente' }
}
export const RECEITAS = [
  {
    id: 'revisao_do_dia', nome: 'Revisão do dia', descricao: 'As vencidas hoje e, se faltar, novas do banco.', usaIa: false,
    blocos: (r) => [blocoPadrao('revisao', r, { nome: 'Revisão do dia', quantidade: 20 })],
  },
  {
    id: 'reforco_erros', nome: 'Reforço dos erros', descricao: 'As que você errou em 14 dias, para tentar de novo.', usaIa: false,
    blocos: (r) => [blocoPadrao('revisao', r, { nome: 'Reforço dos erros', origem: 'erradas', completarNovas: false, quantidade: 15 })],
  },
  {
    id: 'aprender_fixar', nome: 'Aprender e fixar', descricao: 'Questões novas de um assunto, depois as vencidas dele.', usaIa: false,
    blocos: (r) => [
      blocoPadrao('pratica', r, { nome: 'Praticar o novo', quantidade: 12, dificuldade: curvaSobe(r) }),
      blocoPadrao('revisao', r, { nome: 'Fixar o que já viu', quantidade: 8, completarNovas: false }),
    ],
  },
  {
    id: 'estudo_serio', nome: 'Estudo sério', descricao: 'Aquece com o que venceu, pratica o novo e volta nos erros do próprio conjunto.', usaIa: false,
    blocos: (r) => [
      blocoPadrao('revisao', r, { nome: 'Aquecer com o que venceu', quantidade: 8, correcao: 'fim', completarNovas: false }),
      blocoPadrao('pratica', r, { nome: 'Praticar o novo', quantidade: 12, tipos: [...GRUPOS_TIPOS.ESCRITA_ANALISE], dificuldade: curvaSobe(r) }),
      blocoPadrao('revisao', r, { nome: 'Voltar nos erros', origem: 'erros_conjunto', quantidade: 6, completarNovas: false, repetir: true }),
    ],
  },
  {
    id: 'rapida', nome: 'Rápida', descricao: '6 questões de escolha, sem cronômetro.', usaIa: false,
    blocos: (r) => [blocoPadrao('revisao', r, { nome: 'Rápida', quantidade: 6, tipos: [...GRUPOS_TIPOS.ESCOLHA_RAPIDA] })],
  },
  {
    id: 'desafio', nome: 'Desafio', descricao: 'Muito difícil, sem dica, tipos de análise.', usaIa: true,
    blocos: (r) => [blocoPadrao('pratica', r, { nome: 'Desafio', quantidade: 10, dicas: 0, tipos: [...GRUPOS_TIPOS.ANALISE], completarIa: true, dificuldade: { ...configBase(r).dificuldade, modo: 'fixa', nivel: 4 } })],
  },
  {
    id: 'intercalada', nome: 'Intercalada', descricao: '3 ou mais assuntos misturados, uma questão de cada vez.', usaIa: false,
    blocos: (r) => [blocoPadrao('revisao', r, { nome: 'Intercalada', quantidade: 18 })],
  },
  {
    id: 'pre_prova', nome: 'Pré-prova', descricao: 'Assuntos da prova marcada, com peso nos mais fracos.', usaIa: false,
    blocos: (r) => [blocoPadrao('pratica', r, { nome: 'Praticar para a prova', quantidade: 10 }), blocoPadrao('revisao', r, { nome: 'Revisar para a prova', quantidade: 15 })],
  },
]
export const RECEITA = Object.fromEntries(RECEITAS.map((r) => [r.id, r]))

export function blocosDaReceita(id, ritmo = RITMO_PADRAO) {
  return (RECEITA[id] ?? RECEITA.revisao_do_dia).blocos(ritmo)
}

// Situação de cada receita para a tela Estudar: disponível, recomendada e por quê.
// ctx: { vencidas, erros14, assuntoMaisErrado: { nome, erros }, proficientes, pertoDeProficiente: { nome, proficiencia, meta }, muitoDificilLiberado, ritmo }
export function situacaoDasReceitas(ctx) {
  const r = ctx.ritmo ?? RITMO_PADRAO
  return RECEITAS.map((rec) => {
    let disponivel = true
    let recomendado = false
    let motivo = ''
    switch (rec.id) {
      case 'revisao_do_dia':
        recomendado = ctx.vencidas > 0
        motivo = ctx.vencidas ? `Recomendado: ${ctx.vencidas} ${ctx.vencidas === 1 ? 'questão venceu' : 'questões venceram'} hoje.` : 'Nenhuma vencida hoje: entram as que você respondeu há mais tempo.'
        break
      case 'reforco_erros':
        disponivel = ctx.erros14 > 0
        recomendado = ctx.erros14 >= 5
        motivo = !ctx.erros14 ? 'Nenhum erro nos últimos 14 dias.' : recomendado && ctx.assuntoMaisErrado ? `Recomendado: ${ctx.assuntoMaisErrado.erros} erros em ${ctx.assuntoMaisErrado.nome} em 14 dias.` : `${ctx.erros14} ${ctx.erros14 === 1 ? 'erro' : 'erros'} nos últimos 14 dias.`
        break
      case 'aprender_fixar':
        motivo = 'Para assunto que você começou a estudar agora.'
        break
      case 'estudo_serio':
        motivo = `Padrão do ritmo ${ritmoDe(r).nome ?? r}.`
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
        disponivel = (ctx.proficientes ?? 0) >= 3
        motivo = disponivel ? 'Vários assuntos proficientes: misturar ajuda a lembrar.' : `Abre com 3 assuntos proficientes. Você tem ${ctx.proficientes ?? 0}.`
        recomendado = disponivel
        break
      case 'pre_prova':
        disponivel = false
        motivo = 'Marque uma prova na Agenda para usar. A Agenda chega numa próxima etapa.'
        break
      default:
    }
    const blocos = rec.blocos(r)
    return { id: rec.id, nome: rec.nome, descricao: rec.descricao, usaIa: rec.usaIa, tipos: blocos.map((b) => b.tipo), disponivel, recomendado: disponivel && recomendado, motivo }
  })
}

// ---------- Ler o que veio da tela ----------
const texto = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// libera: { muitoDificil, impossivel, disfarcar }. Devolve { blocos } ou { erro }.
export function lerBlocos(lista, libera = {}) {
  if (!Array.isArray(lista) || !lista.length) return { erro: 'O conjunto precisa de pelo menos um bloco.' }
  if (lista.length > MAX_BLOCOS) return { erro: `Um conjunto tem no máximo ${MAX_BLOCOS} blocos.` }
  const brutos = lista.map((b) => (b && typeof b === 'object' ? b : {}))
  const deErros = (b) => b.tipo !== 'pratica' && b.origem === 'erros_conjunto'
  if (brutos.every(deErros)) return { erro: 'Um bloco de erros precisa de outro bloco antes, com assuntos.' }
  // Bloco de erros usa os assuntos dos outros blocos.
  const todos = new Map()
  for (const b of brutos) if (!deErros(b)) for (const a of Array.isArray(b.assuntos) ? b.assuntos : []) if (a?.id && !todos.has(a.id)) todos.set(a.id, { id: a.id, peso: 1 })
  const blocos = []
  for (const [i, b] of brutos.entries()) {
    const tipo = b.tipo === 'pratica' ? 'pratica' : 'revisao'
    const origens = ORIGENS_BLOCO[tipo].map((o) => o.id)
    const origem = origens.includes(b.origem) ? b.origem : origens[0]
    const assuntos = origem === 'erros_conjunto' ? [...todos.values()] : b.assuntos
    const lido = lerConfigRevisao({ ...b, assuntos, origem: origemDoSorteio({ tipo, origem }) }, libera)
    if (lido.erro) return { erro: `Bloco ${i + 1}: ${lido.erro.charAt(0).toLowerCase()}${lido.erro.slice(1)}` }
    const c = lido.config
    delete c.modelo
    blocos.push({
      ...c,
      tipo,
      nome: texto(b.nome, MAX_NOME_BLOCO) || TIPOS_BLOCO[tipo].nome,
      origem,
      completarNovas: tipo === 'revisao' && origem === 'vencidas' && b.completarNovas === true,
      completarMaterial: tipo === 'pratica' && b.completarMaterial === true,
      completarIa: tipo === 'pratica' && b.completarIa === true,
      repetir: origem === 'erros_conjunto' ? true : b.repetir === true,
    })
  }
  const total = blocos.reduce((s, b) => s + b.quantidade, 0)
  if (total > MAX_CONJUNTO) return { erro: `O conjunto passou de ${MAX_CONJUNTO} questões (tem ${total}). Tire questões de algum bloco.` }
  return { blocos }
}

export function lerNomeConjunto(nome) {
  const n = texto(nome, MAX_NOME_CONJUNTO)
  return n ? { nome: n } : { erro: 'Dê um nome ao conjunto.' }
}

// Config para o sorteio de um bloco (formato de revisoes.escolherQuestoes).
export const configDoSorteio = (bloco) => ({ ...bloco, origem: origemDoSorteio(bloco) })

// ---------- Textos ----------
const juntar = (lista) => (lista.length <= 1 ? lista.join('') : `${lista.slice(0, -1).join(', ')} e ${lista.at(-1)}`)
const DIFICULDADE_CURTA = (d) => {
  if (!d) return ''
  if (d.modo === 'fixa') return nomeDoNivel(d.nivel)
  if (d.modo === 'curva') return d.de === d.ate ? nomeDoNivel(d.de) : `do ${nomeDoNivel(Math.min(d.de, d.ate))} ao ${nomeDoNivel(Math.max(d.de, d.ate))}`
  if (d.modo === 'aleatoria') return 'níveis sorteados'
  if (d.modo === 'distribuir') return 'níveis distribuídos'
  return 'adaptativa'
}
const CORRECAO_TEXTO = { cada: 'Correção a cada questão', bloco: 'Correção no fim do bloco', fim: 'Correção no fim do conjunto' }

// Uma linha sobre o bloco, para o cartão fechado. nomes: { [assuntoId]: nome }.
export function resumoDoBloco(bloco, nomes = {}) {
  const partes = []
  if (bloco.origem === 'erros_conjunto') partes.push('As que você errar nos blocos anteriores. Se forem poucas, completa com erradas dos últimos 14 dias')
  else {
    const ass = (bloco.assuntos ?? []).map((a) => nomes[a.id]).filter(Boolean)
    if (ass.length) partes.push(ass.length > 3 ? `${juntar(ass.slice(0, 3))} e mais ${ass.length - 3}` : juntar(ass))
    else partes.push('Sem assunto marcado')
    const fonte = {
      vencidas: bloco.completarNovas ? 'Vencidas primeiro; se faltar, novas do banco' : 'Já respondidas, vencidas primeiro',
      erradas: 'Erradas em 14 dias',
      novas: ['Novas do banco', bloco.completarMaterial && 'do material', bloco.completarIa && 'da IA'].filter(Boolean).join(', '),
      importadas: 'Importadas que você ainda não respondeu',
    }[bloco.origem]
    partes.push(`${fonte}, ${DIFICULDADE_CURTA(bloco.dificuldade)}`)
  }
  partes.push(`${CORRECAO_TEXTO[bloco.correcao] ?? CORRECAO_TEXTO.cada}, ${bloco.dicas ? 'dicas conforme o nível' : 'sem dicas'}`)
  return `${partes.join('. ')}.`
}

export const usaIaNoConjunto = (blocos) => blocos.some((b) => b.tipo === 'pratica' && b.completarIa)

// Blocos de uma execução (as antigas, de antes dos conjuntos, viram um bloco só com a config da revisão).
export function blocosDaExecucao(revisao) {
  if (Array.isArray(revisao?.blocos) && revisao.blocos.length) return revisao.blocos
  return [{ tipo: 'revisao', nome: revisao?.titulo ?? 'Revisão', config: revisao?.config ?? {}, quantidade: revisao?.total ?? 0, preparado: true }]
}
export const configDoBloco = (revisao, bloco = 0) => blocosDaExecucao(revisao)[bloco]?.config ?? revisao?.config ?? {}

// Ordem dos itens: cada bloco ocupa uma faixa de 100 (bloco 2 começa no 200).
export const ordemNoBloco = (bloco, i) => bloco * 100 + i

// ---------- Sorteio do conjunto ----------
// Sorteia os blocos em sequência. Devolve, para cada bloco, { itens, faltam, disponiveis, excluidas, adiado, reserva }.
export function sortearBlocos(blocos, pool, thetas, semente, { preencherComOutros = true } = {}) {
  const usadas = new Set()
  return blocos.map((b, k) => {
    const rng = sorteador(`${semente}-${k}`)
    const cfg = configDoSorteio(b)
    if (b.origem === 'erros_conjunto') {
      // Montado na hora. Aqui só a reserva: erradas em 14 dias, para quando os blocos anteriores tiverem poucos erros.
      const r = escolherQuestoes(pool, cfg, { rng, thetas, preencherComOutros: true })
      return { adiado: true, itens: [], faltam: {}, disponiveis: r.disponiveis, excluidas: 0, reserva: r.itens.length, completadasComNovas: 0 }
    }
    const excluir = b.repetir ? null : usadas
    const r = escolherQuestoes(pool, cfg, { rng, thetas, preencherComOutros, excluir })
    let itens = r.itens
    let faltam = r.faltam
    let completadasComNovas = 0
    if (b.tipo === 'revisao' && b.completarNovas && itens.length < b.quantidade) {
      const ex = new Set([...(excluir ?? []), ...itens.map((q) => q.id)])
      const r2 = escolherQuestoes(pool, { ...cfg, origem: 'pratica', quantidade: b.quantidade - itens.length }, { rng, thetas, preencherComOutros: true, excluir: ex })
      completadasComNovas = r2.itens.length
      itens = [...itens, ...r2.itens]
      if (itens.length >= b.quantidade) faltam = {}
    }
    for (const q of itens) usadas.add(q.id)
    return { adiado: false, itens, faltam, disponiveis: r.disponiveis, excluidas: r.excluidas, reserva: 0, completadasComNovas }
  })
}

export function resumoDoSorteio(blocos, plano) {
  const porBloco = plano.map((p, k) => {
    const b = blocos[k]
    const faltam = p.adiado ? 0 : Math.max(0, b.quantidade - p.itens.length)
    return {
      tipo: b.tipo,
      adiado: p.adiado,
      pedidas: b.quantidade,
      total: p.adiado ? b.quantidade : p.itens.length,
      vencidas: p.itens.filter((q) => q.vencida).length,
      novas: p.itens.filter((q) => q.nova).length,
      completadasComNovas: p.completadasComNovas,
      faltam,
      podeCompletar: b.tipo === 'pratica' && (b.completarMaterial || b.completarIa) && faltam > 0,
      disponiveis: p.disponiveis,
      excluidas: p.excluidas,
      reserva: p.reserva,
      minutos: p.adiado ? minutosEstimados(Array(b.quantidade).fill({ tipo: b.tipos[0], nivel: b.dificuldade.nivel ?? 2 })) : minutosEstimados(p.itens.length ? p.itens : []),
      porAssunto: p.itens.reduce((m, q) => ((m[q.assunto_id] = (m[q.assunto_id] ?? 0) + 1), m), {}),
    }
  })
  const soma = (f) => porBloco.reduce((s, b) => s + f(b), 0)
  return {
    blocos: porBloco,
    total: soma((b) => b.total),
    pedidas: soma((b) => b.pedidas),
    minutos: soma((b) => (b.total ? b.minutos : 0)),
    doBanco: soma((b) => (b.adiado ? 0 : b.total)),
    vencidas: soma((b) => b.vencidas),
    novas: soma((b) => b.novas),
    faltam: soma((b) => b.faltam),
    usaIa: usaIaNoConjunto(blocos),
  }
}
