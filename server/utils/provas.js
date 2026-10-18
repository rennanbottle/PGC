// Prova no servidor. A prova é uma execução do estudo (revisoes e revisao_itens) com tipo 'prova': o caderno é
// montado do banco (só tipos que o PGC corrige sozinho), as respostas ficam no rascunho de cada item sem correção, e
// ao entregar tudo é corrigido de uma vez (dificuldade da questão, cartão FSRS, proficiência e pontos, como no
// estudo). As regras puras ficam em shared/regras/provas.js.
import { blocoPadrao } from '#shared/regras/conjuntos.js'
import { DIFICULDADE_PROVA, formatoDe, notaDaProva, respostaPreenchida, sortearCaderno, textoPorNivel, trocarNoCaderno } from '#shared/regras/provas.js'
import { dataDoDia, diaDeBrasilia, notaDaResposta } from '#shared/regras/revisoes.js'
import { corrigir, sorteador } from '#shared/regras/sessao.js'
import { atualizar, B_INICIAL, chanceChute, probabilidade } from '#shared/regras/proficiencia.js'
import { proximaRevisaoEmDias, retencao, revisar } from '#shared/regras/retencao.js'
import { HORAS_RECENTE, pontosResposta } from '#shared/regras/pontos.js'
import { emLotes } from './consultas.js'
import { atualizarContagem, candidatas, carregarRevisao, thetasDe } from './revisoes.js'
import { concluirRevisao } from './concluir.js'

// Configuração do bloco único da prova: sem dica, sem nível na questão, sem formulário, correção só no fim.
export function configDoBlocoDaProva(config, ritmo) {
  return {
    ...blocoPadrao('revisao', ritmo),
    nome: 'Prova',
    origem: 'banco',
    completarNovas: false,
    assuntos: config.assuntos,
    quantidade: config.quantas,
    tipos: formatoDe(config.formato).tipos,
    ordem: config.ordem === 'materia' ? 'assunto' : 'intercalada',
    dificuldade: DIFICULDADE_PROVA,
    nivelNaQuestao: 'esconder',
    dicas: 0,
    formulario: false,
    cronometro: { modo: 'sem', minutos: config.minutos, segundos: 90 },
    correcao: 'fim',
    avancar: false,
  }
}

// ---------- Caderno ----------
// Sorteia o caderno (ou mantém o da prévia, trocando as questões pedidas). Devolve { itens, disponiveis }.
export async function montarCaderno(supabase, config, { semente, caderno = null, trocar = [] } = {}) {
  const ids = config.assuntos.map((a) => a.id)
  const pool = await candidatas(supabase, ids)
  const rng = sorteador(String(semente ?? Date.now()))
  const disponiveis = pool.filter((q) => formatoDe(config.formato).tipos.includes(q.tipo)).length
  if (Array.isArray(caderno) && caderno.length) {
    return { itens: trocarNoCaderno(pool, caderno, trocar, { rng, quantas: config.quantas, formato: config.formato }), disponiveis }
  }
  const thetas = config.fracos ? await thetasDe(supabase, ids) : {}
  return { itens: sortearCaderno(pool, config, { rng, thetas }), disponiveis }
}

// Prévia para a tela de montar: o caderno com o começo de cada enunciado, quanto cai de cada matéria e de cada nível.
export async function previaDaProva(supabase, config, opcoes) {
  const { itens, disponiveis } = await montarCaderno(supabase, config, opcoes)
  const enunciados = new Map()
  for (const lote of emLotes(itens.map((q) => q.id), 200)) {
    const { data } = await supabase.from('questoes').select('id, enunciado').in('id', lote)
    for (const q of data ?? []) enunciados.set(q.id, String(q.enunciado ?? '').slice(0, 240))
  }
  const assuntoIds = [...new Set(itens.map((q) => q.assunto_id).filter(Boolean))]
  const { data: assuntos } = assuntoIds.length ? await supabase.from('assuntos').select('id, materias(nome, cor)').in('id', assuntoIds) : { data: [] }
  const materiaDe = new Map((assuntos ?? []).map((a) => [a.id, a.materias ?? { nome: 'Sem matéria', cor: 'cinza' }]))
  const porMateria = new Map()
  const porNivel = {}
  for (const q of itens) {
    const m = materiaDe.get(q.assunto_id) ?? { nome: 'Sem matéria', cor: 'cinza' }
    const g = porMateria.get(m.nome) ?? { materia: m.nome, cor: m.cor ?? 'cinza', n: 0 }
    g.n++
    porMateria.set(m.nome, g)
    porNivel[q.nivel] = (porNivel[q.nivel] ?? 0) + 1
  }
  return {
    caderno: itens.map((q) => ({ questaoId: q.id, tipo: q.tipo, assuntoId: q.assunto_id, nivel: q.nivel, enunciado: enunciados.get(q.id) ?? '' })),
    porMateria: [...porMateria.values()].sort((a, b) => b.n - a.n),
    porNivel: textoPorNivel(porNivel),
    faltam: Math.max(0, config.quantas - itens.length),
    disponiveis,
  }
}

// ---------- Tempo ----------
export const restanteDe = (revisao, agora = Date.now()) => Math.max(0, Math.round((new Date(revisao.termina_em).getTime() - agora) / 1000))
// Tolerância de 20 s para a última resposta chegar depois do relógio zerar na tela.
export const tempoAcabou = (revisao, agora = Date.now()) => agora > new Date(revisao.termina_em).getTime() + 20000

// ---------- Entregar ----------
// Corrige de uma vez as respostas guardadas. Lê tudo o que precisa antes (proficiência, dificuldade e cartão de
// cada questão), calcula na ordem do caderno e grava em lote.
async function corrigirTudo({ admin, usuarioId, itens }) {
  const abertos = itens.filter((i) => !i.resultado && i.rascunho?.resposta && respostaPreenchida(i.tipo, i.rascunho.resposta))
  if (!abertos.length) return
  const agora = new Date()
  const dia = diaDeBrasilia(agora)
  const qIds = [...new Set(abertos.map((i) => i.questao_id).filter(Boolean))]
  const aIds = [...new Set(abertos.map((i) => i.assunto_id).filter(Boolean))]
  const profs = new Map()
  const questoes = new Map()
  const cartoes = new Map()
  if (aIds.length) {
    const { data } = await admin.from('proficiencias').select('assunto_id, theta, n').eq('usuario_id', usuarioId).in('assunto_id', aIds)
    for (const p of data ?? []) profs.set(p.assunto_id, { theta: p.theta ?? 0, n: p.n ?? 0 })
  }
  for (const lote of emLotes(qIds, 200)) {
    const [{ data: qs }, { data: cs }] = await Promise.all([
      admin.from('questoes').select('id, dificuldade_b, respostas_b').eq('usuario_id', usuarioId).in('id', lote),
      admin.from('questao_cartoes').select('*').eq('usuario_id', usuarioId).in('questao_id', lote),
    ])
    for (const q of qs ?? []) questoes.set(q.id, q)
    for (const c of cs ?? []) cartoes.set(c.questao_id, c)
  }

  const linhas = []
  const novasQuestoes = new Map()
  const novosCartoes = []
  const novasProfs = new Map()
  for (const item of abertos) {
    const q = item.snapshot
    const resposta = item.rascunho.resposta
    const c = corrigir(q, item.semente, resposta)
    if (c.pendente) continue // não acontece: a prova só tem tipos que o PGC corrige sozinho
    const nAlternativas = Array.isArray(q.conteudo?.alternativas) ? q.conteudo.alternativas.length : 5
    const qd = item.questao_id ? questoes.get(item.questao_id) : null
    const b = qd?.dificuldade_b ?? q.b ?? B_INICIAL[item.nivel] ?? 0
    const aluno = (item.assunto_id && profs.get(item.assunto_id)) || { theta: 0, n: 0 }
    const previsto = probabilidade(aluno.theta, b, chanceChute(item.tipo, nAlternativas))
    const cartao = item.questao_id ? cartoes.get(item.questao_id) : null
    const retencaoAntes = cartao ? retencao(Math.max(0, dia - cartao.ultimo_dia), cartao.estabilidade) : null
    const recente = !!cartao && agora.getTime() - new Date(cartao.respondida_em).getTime() < HORAS_RECENTE * 3600 * 1000
    const pontos = pontosResposta({ tipo: item.tipo, resultado: c.resultado, dicas: 0, previsto, bloom: item.bloom, retencaoAntes, recente, confianca: c.confianca })
    linhas.push({
      id: item.id,
      mudar: {
        resposta, rascunho: null, resultado: c.resultado, credito: c.credito, confianca: c.confianca, pendente: false, incerta: false,
        previsto: Math.round(previsto * 1000) / 1000, retencao_antes: retencaoAntes === null ? null : Math.round(retencaoAntes * 1000) / 1000,
        recente, pontos, respondida_em: agora.toISOString(),
      },
    })
    if (c.confianca !== 'alta' || !item.questao_id) continue
    const out = atualizar(aluno, { tipo: item.tipo, alternativas: nAlternativas, b, m: qd?.respostas_b ?? 0 }, { resultado: c.resultado, dicas: 0 })
    const novaQ = { id: item.questao_id, dificuldade_b: Math.round(out.questao.b * 1000) / 1000, respostas_b: out.questao.m }
    questoes.set(item.questao_id, novaQ)
    novasQuestoes.set(item.questao_id, novaQ)
    const novo = revisar(cartao ? { S: cartao.estabilidade, D: cartao.dificuldade, ultimo: cartao.ultimo_dia, reps: cartao.repeticoes } : null, notaDaResposta(c.resultado, 0, false), dia)
    novosCartoes.push({
      questao_id: item.questao_id, usuario_id: usuarioId, estabilidade: novo.S, dificuldade: novo.D, ultimo_dia: dia, repeticoes: novo.reps,
      proxima: dataDoDia(dia + proximaRevisaoEmDias(novo.S)), ultimo_resultado: c.resultado, respondida_em: agora.toISOString(),
    })
    if (item.assunto_id) {
      profs.set(item.assunto_id, out.aluno)
      novasProfs.set(item.assunto_id, { assunto_id: item.assunto_id, usuario_id: usuarioId, theta: out.aluno.theta, n: out.aluno.n, atualizado_em: agora.toISOString() })
    }
  }

  // Gravar: itens e questões uma a uma (10 por vez), cartões e proficiências de uma vez.
  for (const lote of emLotes(linhas, 10)) {
    await Promise.all(lote.map((l) => admin.from('revisao_itens').update(l.mudar).eq('id', l.id).eq('usuario_id', usuarioId)))
  }
  for (const lote of emLotes([...novasQuestoes.values()], 10)) {
    await Promise.all(lote.map((q) => admin.from('questoes').update({ dificuldade_b: q.dificuldade_b, respostas_b: q.respostas_b }).eq('id', q.id).eq('usuario_id', usuarioId)))
  }
  if (novosCartoes.length) await admin.from('questao_cartoes').upsert(novosCartoes, { onConflict: 'questao_id' })
  if (novasProfs.size) await admin.from('proficiencias').upsert([...novasProfs.values()], { onConflict: 'assunto_id' })
}

// Entrega a prova (pela pessoa ou porque o tempo acabou). Só uma entrega por vez: a prova passa para "pausada"
// enquanto é corrigida; uma trava com mais de 2 minutos (algo falhou no meio) pode ser retomada.
export async function entregarProva({ admin, supabase, usuarioId, revisao, porTempo = false }) {
  if (revisao.status === 'concluida') return { jaEntregue: true }
  const agora = new Date()
  let travou = false
  if (revisao.status === 'em_andamento') {
    const { data } = await admin.from('revisoes').update({ status: 'pausada', pausada_em: agora.toISOString() })
      .eq('id', revisao.id).eq('usuario_id', usuarioId).eq('status', 'em_andamento').select('id')
    travou = !!data?.length
  }
  else if (revisao.status === 'pausada' && agora.getTime() - new Date(revisao.pausada_em ?? 0).getTime() > 120000) {
    const { data } = await admin.from('revisoes').update({ pausada_em: agora.toISOString() })
      .eq('id', revisao.id).eq('usuario_id', usuarioId).eq('status', 'pausada').eq('pausada_em', revisao.pausada_em).select('id')
    travou = !!data?.length
  }
  if (!travou) return { entregando: true }

  const { itens } = await carregarRevisao(admin, usuarioId, revisao.id, { tipo: 'prova' })
  await corrigirTudo({ admin, usuarioId, itens })
  const { revisao: atual, itens: corrigidos } = await carregarRevisao(admin, usuarioId, revisao.id, { tipo: 'prova' })
  await atualizarContagem(admin, usuarioId, revisao.id)
  await concluirRevisao({ admin, supabase, usuarioId, revisao: atual, itens: corrigidos, encerrar: true })
  const nota = notaDaProva(corrigidos.map((i) => ({ correcao: i.resultado ? { resultado: i.resultado } : null })), atual.prova?.formato)
  const { data: fechada } = await admin.from('revisoes').select('resultado').eq('id', revisao.id).eq('usuario_id', usuarioId).single()
  await admin.from('revisoes').update({ entregue_por_tempo: !!porTempo, resultado: { ...(fechada?.resultado ?? {}), nota } }).eq('id', revisao.id).eq('usuario_id', usuarioId)
  return { entregue: true }
}

// Carrega a prova e, se o tempo já acabou sem entregar, entrega antes (com o que estava marcado). Uma entrega que
// parou no meio (trava velha) também é retomada aqui.
export async function provaEmDia({ admin, supabase, usuarioId, id }) {
  let { revisao, itens } = await carregarRevisao(admin, usuarioId, id, { tipo: 'prova' })
  if (revisao.status !== 'concluida' && (tempoAcabou(revisao) || revisao.status === 'pausada')) {
    await entregarProva({ admin, supabase, usuarioId, revisao, porTempo: tempoAcabou(revisao) })
    ;({ revisao, itens } = await carregarRevisao(admin, usuarioId, id, { tipo: 'prova' }))
  }
  return { revisao, itens }
}

export async function assuntosDaProva(supabase, itens) {
  const ids = [...new Set(itens.map((i) => i.assunto_id).filter(Boolean))].slice(0, 120)
  const { data } = ids.length ? await supabase.from('assuntos').select('id, nome, materias(nome, cor)').in('id', ids) : { data: [] }
  return Object.fromEntries((data ?? []).map((a) => [a.id, { nome: a.nome, materia: a.materias?.nome ?? '', cor: a.materias?.cor ?? 'cinza' }]))
}

// Nota guardada na entrega, para listas e comparações (sem ler os itens de novo).
export const porcentagemDe = (r) => Number(r?.resultado?.nota?.porcentagem ?? 0)
