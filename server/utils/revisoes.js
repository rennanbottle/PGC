// Revisões no servidor. As tabelas de revisão, cartões, proficiência e pontos só aceitam escrita pela chave secreta:
// aqui a pessoa é conferida (sessão), e a escrita usa o cliente "admin" sempre filtrando pelo id dela.
// As regras puras ficam em shared/regras (revisoes.js, sessao.js, proficiencia.js, retencao.js, pontos.js, dominio.js).
import { randomBytes } from 'node:crypto'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { LETRAS } from '#shared/regras/questoes.js'
import { atualizar, chanceChute, probabilidade, B_INICIAL } from '#shared/regras/proficiencia.js'
import { revisar, retencao, proximaRevisaoEmDias } from '#shared/regras/retencao.js'
import { escolherQuestoes, nivelMostrado, notaDaResposta, diaDeBrasilia, dataDoDia } from '#shared/regras/revisoes.js'
import { blocosDaExecucao, configDoBloco, configDoSorteio, ordemNoBloco } from '#shared/regras/conjuntos.js'
import { corrigir, dicas as dicasDaQuestao, maxDicasDoNivel, paraResponder, sorteador } from '#shared/regras/sessao.js'
import { HORAS_RECENTE, pontosResposta } from '#shared/regras/pontos.js'
import { UUID, emLotes, todasAsLinhas } from './consultas.js'

export async function pessoa(event) {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  exigirChaveSecreta('o estudo')
  return { usuario, supabase: await serverSupabaseClient(event), admin: await serverSupabaseServiceRole(event) }
}

export const diaComFracao = (data = new Date()) => (new Date(data).getTime() - 3 * 3600 * 1000) / 86400000

// ---------- Candidatas ----------
// Questões ativas e dentro das revisões dos assuntos pedidos, com o que o FSRS sabe de cada uma.
export async function candidatas(supabase, assuntoIds) {
  const hoje = diaDeBrasilia()
  const questoes = await todasAsLinhas((de, ate) => supabase.from('questoes')
    .select('id, assunto_id, materia_id, tipo, nivel, bloom, dificuldade_b, origem')
    .in('assunto_id', assuntoIds).eq('em_revisao', true).range(de, ate))
  const ids = questoes.map((q) => q.id)
  const cartoes = new Map()
  for (const lote of emLotes(ids, 300)) {
    const { data } = await supabase.from('questao_cartoes').select('questao_id, proxima, respondida_em, ultimo_resultado').in('questao_id', lote)
    for (const c of data ?? []) cartoes.set(c.questao_id, c)
  }
  const limite14 = new Date(Date.now() - 14 * 86400000).toISOString()
  const erradas = new Set()
  const { data: erros } = await supabase.from('revisao_itens').select('questao_id').eq('resultado', 'incorreta').gte('respondida_em', limite14).in('assunto_id', assuntoIds).limit(2000)
  for (const e of erros ?? []) if (e.questao_id) erradas.add(e.questao_id)
  const hojeTexto = dataDoDia(hoje)
  const recente = Date.now() - HORAS_RECENTE * 3600 * 1000
  return questoes.map((q) => {
    const c = cartoes.get(q.id)
    return {
      ...q,
      b: q.dificuldade_b ?? B_INICIAL[q.nivel] ?? 0,
      vencida: !!c && c.proxima <= hojeTexto,
      nova: !c,
      errada: erradas.has(q.id),
      importada: q.origem === 'importada',
      recente: !!c && new Date(c.respondida_em).getTime() > recente,
    }
  })
}

export async function thetasDe(supabase, assuntoIds) {
  const { data } = await supabase.from('proficiencias').select('assunto_id, theta').in('assunto_id', assuntoIds)
  return Object.fromEntries((data ?? []).map((p) => [p.assunto_id, p.theta]))
}

// ---------- Criar ----------
// Congela cada questão no item (snapshot), com a semente do embaralhamento e o nível mostrado.
async function linhasDosItens(supabase, usuario, revisaoId, pedidos, bloco, config) {
  const ids = [...new Set(pedidos.map((i) => i.id))]
  const completas = new Map()
  for (const lote of emLotes(ids, 200)) {
    const { data, error } = await supabase.from('questoes').select('id, assunto_id, materia_id, material_id, trecho_id, tipo, nivel, bloom, enunciado, conteudo, explicacao, fonte, imagem_caminho, dificuldade_b').in('id', lote)
    if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para ler as questões agora.' })
    for (const q of data) completas.set(q.id, q)
  }
  return pedidos.filter((i) => completas.has(i.id)).slice(0, 99).map((i, k) => {
    const q = completas.get(i.id)
    const semente = randomBytes(8).toString('hex')
    return {
      usuario_id: usuario.sub,
      revisao_id: revisaoId,
      ordem: ordemNoBloco(bloco, k),
      bloco,
      questao_id: q.id,
      assunto_id: q.assunto_id,
      materia_id: q.materia_id,
      tipo: q.tipo,
      nivel: q.nivel,
      bloom: q.bloom,
      snapshot: {
        tipo: q.tipo, enunciado: q.enunciado, conteudo: q.conteudo, explicacao: q.explicacao, fonte: q.fonte,
        material_id: q.material_id, trecho_id: q.trecho_id, imagem_caminho: q.imagem_caminho, b: q.dificuldade_b,
      },
      semente,
      nivel_mostrado: nivelMostrado(config?.nivelNaQuestao, q.nivel, sorteador(semente)),
    }
  })
}

const MODELOS_DO_BANCO = new Set(['revisao_do_dia', 'reforco_erros', 'estudo_serio', 'rapida', 'desafio', 'intercalada', 'pre_prova', 'personalizada'])

// Cria a execução. blocos: [{ tipo, nome, config, itens: [{ id }], adiado }]. Um bloco "adiado" (erros deste
// conjunto) não tem itens agora: é montado quando a pessoa chega nele (prepararBloco).
// Prova: tipo 'prova', com a configuração (prova) e o fim do tempo (terminaEm).
export async function criarExecucao({ admin, supabase, usuario, titulo, modelo, conjuntoId = null, blocos, agendada = false, geracaoId = null, tipo = 'estudo', prova = null, terminaEm = null }) {
  const linhasPorBloco = []
  for (const [k, b] of blocos.entries()) linhasPorBloco.push(b.adiado ? [] : await linhasDosItens(supabase, usuario, null, b.itens, k, b.config))
  const copia = blocos.map((b, k) => ({
    tipo: b.tipo, nome: b.nome, config: b.config,
    quantidade: b.adiado ? b.config.quantidade : linhasPorBloco[k].length,
    preparado: !b.adiado,
    pulado: !b.adiado && !linhasPorBloco[k].length, // as questões sumiram entre o sorteio e a gravação
  }))
  const total = copia.reduce((s, b) => s + b.quantidade, 0)
  if (!linhasPorBloco.some((l) => l.length)) throw createError({ statusCode: 409, statusMessage: 'As questões deste estudo não existem mais.' })
  const { data: revisao, error } = await admin.from('revisoes').insert({
    usuario_id: usuario.sub,
    modelo: MODELOS_DO_BANCO.has(modelo) ? modelo : 'personalizada',
    titulo: titulo.slice(0, 120),
    config: blocos[0].config,
    blocos: copia,
    conjunto_id: conjuntoId,
    geracao_id: geracaoId,
    total: Math.max(1, Math.min(60, total)),
    agendada: !!agendada,
    ...(tipo === 'prova' ? { tipo, prova, termina_em: terminaEm } : {}),
  }).select('id').single()
  if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para começar agora.' })
  const linhas = linhasPorBloco.flat().map((l) => ({ ...l, revisao_id: revisao.id }))
  const { error: erroItens } = await admin.from('revisao_itens').insert(linhas)
  if (erroItens) {
    await admin.from('revisoes').delete().eq('id', revisao.id).eq('usuario_id', usuario.sub)
    throw createError({ statusCode: 500, statusMessage: 'Não deu para começar agora.' })
  }
  return revisao.id
}

// Revisão avulsa de um bloco só (refazer as erradas).
export function criarRevisao({ admin, supabase, usuario, config, titulo, itens, agendada }) {
  return criarExecucao({ admin, supabase, usuario, titulo, modelo: config.modelo, agendada, blocos: [{ tipo: 'revisao', nome: titulo.split(',')[0], config, itens }] })
}

// Blocos em que todas as questões já têm resposta.
export function blocosCompletos(itens) {
  const abertos = new Set(itens.filter((i) => !i.resultado).map((i) => i.bloco ?? 0))
  return new Set(itens.map((i) => i.bloco ?? 0).filter((b) => !abertos.has(b)))
}

// Monta o bloco "erros deste conjunto" quando a pessoa chega nele: primeiro as erradas e parciais dos blocos
// anteriores desta execução, depois erradas dos últimos 14 dias que ainda não apareceram. Sem nenhuma, o bloco
// é pulado. Devolve { pulado, quantidade }.
export async function prepararBloco({ admin, supabase, usuario, revisao, itens, bloco }) {
  const blocos = [...blocosDaExecucao(revisao)]
  const b = blocos[bloco]
  if (!b || b.preparado) return { pulado: !!b?.pulado, quantidade: b?.quantidade ?? 0 }
  const cfg = b.config
  const naExecucao = new Set(itens.filter((i) => i.questao_id && i.bloco === bloco).map((i) => i.questao_id))
  const pedidos = []
  for (const i of itens) {
    if ((i.bloco ?? 0) >= bloco || !i.questao_id || !i.resultado || i.resultado === 'correta') continue
    if (pedidos.some((p) => p.id === i.questao_id)) continue
    pedidos.push({ id: i.questao_id })
  }
  let lista = pedidos.slice(0, cfg.quantidade)
  if (lista.length < cfg.quantidade) {
    const ids = (cfg.assuntos ?? []).map((a) => a.id)
    const pool = ids.length ? await candidatas(supabase, ids) : []
    const ja = new Set([...itens.map((i) => i.questao_id).filter(Boolean), ...naExecucao])
    const r = escolherQuestoes(pool, configDoSorteio({ ...cfg, quantidade: cfg.quantidade - lista.length }), { rng: sorteador(revisao.id), excluir: ja })
    lista = [...lista, ...r.itens.map((q) => ({ id: q.id }))]
  }
  const linhas = lista.length ? await linhasDosItens(supabase, usuario, revisao.id, lista, bloco, cfg) : []
  if (linhas.length) {
    const { error } = await admin.from('revisao_itens').insert(linhas)
    if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para montar o próximo bloco.' })
  }
  blocos[bloco] = { ...b, preparado: true, pulado: !linhas.length, quantidade: linhas.length, deErrosAntes: Math.min(pedidos.length, linhas.length) }
  const total = blocos.reduce((s, x) => s + (x.quantidade ?? 0), 0)
  await admin.from('revisoes').update({ blocos, total: Math.max(1, Math.min(60, total)), atualizado_em: new Date().toISOString() }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
  return { pulado: !linhas.length, quantidade: linhas.length }
}

// ---------- Ler a revisão para a tela ----------
// tipo: 'estudo' (padrão: as rotas do estudo não abrem uma prova), 'prova', ou null para qualquer um.
export async function carregarRevisao(admin, usuarioId, id, { tipo = 'estudo' } = {}) {
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: tipo === 'prova' ? 'Prova inválida.' : 'Revisão inválida.' })
  const { data: revisao } = await admin.from('revisoes').select('*').eq('id', id).eq('usuario_id', usuarioId).maybeSingle()
  if (!revisao || (tipo && (revisao.tipo ?? 'estudo') !== tipo)) throw createError({ statusCode: 404, statusMessage: tipo === 'prova' ? 'Prova não encontrada.' : 'Revisão não encontrada.' })
  const { data: itens } = await admin.from('revisao_itens').select('*').eq('revisao_id', id).eq('usuario_id', usuarioId).order('ordem')
  return { revisao, itens: itens ?? [] }
}

export async function trechoDe(admin, usuarioId, trechoId) {
  if (!trechoId) return null
  const { data } = await admin.from('material_trechos').select('texto, pagina, versao_id').eq('id', trechoId).eq('usuario_id', usuarioId).maybeSingle()
  if (!data) return null
  const { data: v } = await admin.from('material_versoes').select('material_id, materiais(titulo)').eq('id', data.versao_id).maybeSingle()
  return { texto: data.texto, pagina: data.pagina, material: v?.materiais?.titulo ?? null, materialId: v?.material_id ?? null }
}

export const dicasPermitidas = (revisao, item) => Math.min(configDoBloco(revisao, item.bloco ?? 0).dicas ?? 3, maxDicasDoNivel(item.nivel))

// A correção do item aparece agora? A cada questão: sim. No fim do bloco: quando o bloco todo tem resposta.
// No fim do conjunto: só quando a execução termina.
export function correcaoVisivel(revisao, item, completos) {
  if (revisao.status === 'concluida') return true
  const c = configDoBloco(revisao, item.bloco ?? 0).correcao
  if (c === 'fim') return false
  if (c === 'bloco') return !!completos?.has(item.bloco ?? 0)
  return true
}

// O que a tela recebe de um item. Antes de responder: sem gabarito. Depois: a correção, quando ela já pode aparecer.
export async function itemParaTela(admin, usuarioId, revisao, item, { comCorrecao, completos } = {}) {
  const q = item.snapshot
  const base = {
    id: item.id,
    questaoId: item.questao_id ?? null,
    ordem: item.ordem,
    bloco: item.bloco ?? 0,
    tipo: item.tipo,
    assuntoId: item.assunto_id,
    nivelMostrado: item.nivel_mostrado,
    questao: paraResponder(q, item.semente),
    imagem: q.imagem_caminho ?? null,
    marcada: item.marcada,
    incerta: item.incerta,
    respondida: !!item.resultado,
    pendente: item.pendente,
    resposta: item.resposta,
    rascunho: item.resultado || item.pendente ? null : item.rascunho ?? null,
    segundos: item.segundos ?? 0,
    dicasUsadas: item.dicas_usadas,
    dicasPermitidas: dicasPermitidas(revisao, item),
  }
  if (item.dicas_usadas) {
    const trecho = await trechoDe(admin, usuarioId, q.trecho_id)
    base.dicas = dicasDaQuestao(q, item.semente, { trecho }).slice(0, item.dicas_usadas)
  }
  if (item.pendente) base.revelar = corrigir(q, item.semente, item.resposta ?? {}).revelar
  const mostrar = comCorrecao ?? correcaoVisivel(revisao, item, completos)
  if (item.resultado && mostrar) base.correcao = await correcaoDoItem(admin, usuarioId, item)
  return base
}

export async function correcaoDoItem(admin, usuarioId, item) {
  const q = item.snapshot
  const c = corrigir(q, item.semente, item.resposta ?? {})
  return {
    resultado: item.resultado,
    detalhe: c.detalhe ?? {},
    revelar: c.detalhe,
    explicacao: q.explicacao ?? null,
    trecho: await trechoDe(admin, usuarioId, q.trecho_id),
    nivel: item.nivel,
    pontos: item.pontos,
    leu: item.leu_correcao,
  }
}

// ---------- Responder ----------
export async function registrarResposta({ admin, usuarioId, revisao, item, resposta, incerta, segundos }) {
  const q = item.snapshot
  const c = corrigir(q, item.semente, resposta)
  const seg = Math.max(0, Math.min(3600, Math.round(Number(segundos) || 0)))
  if (c.pendente) {
    await admin.from('revisao_itens').update({ resposta, rascunho: null, pendente: true, incerta: !!incerta, segundos: item.segundos + seg }).eq('id', item.id).eq('usuario_id', usuarioId)
    return { pendente: true, revelar: c.revelar }
  }
  const alta = c.confianca === 'alta'
  const agora = new Date()
  const dia = diaDeBrasilia(agora)

  // Chance prevista pela proficiência do assunto e dificuldade atual da questão.
  const { data: prof } = item.assunto_id
    ? await admin.from('proficiencias').select('theta, n').eq('assunto_id', item.assunto_id).eq('usuario_id', usuarioId).maybeSingle()
    : { data: null }
  const { data: questao } = item.questao_id
    ? await admin.from('questoes').select('dificuldade_b, respostas_b').eq('id', item.questao_id).eq('usuario_id', usuarioId).maybeSingle()
    : { data: null }
  const nAlternativas = Array.isArray(q.conteudo?.alternativas) ? q.conteudo.alternativas.length : 5
  const b = questao?.dificuldade_b ?? q.b ?? B_INICIAL[item.nivel] ?? 0
  const aluno = { theta: prof?.theta ?? 0, n: prof?.n ?? 0 }
  const previsto = probabilidade(aluno.theta, b, chanceChute(item.tipo, nAlternativas))

  // Retenção da questão antes de responder (FSRS) e se ela foi respondida há menos de 20 horas.
  const { data: cartao } = item.questao_id
    ? await admin.from('questao_cartoes').select('*').eq('questao_id', item.questao_id).eq('usuario_id', usuarioId).maybeSingle()
    : { data: null }
  const retencaoAntes = cartao ? retencao(Math.max(0, dia - cartao.ultimo_dia), cartao.estabilidade) : null
  const recente = !!cartao && agora.getTime() - new Date(cartao.respondida_em).getTime() < HORAS_RECENTE * 3600 * 1000

  const pontos = pontosResposta({ tipo: item.tipo, resultado: c.resultado, dicas: item.dicas_usadas, previsto, bloom: item.bloom, retencaoAntes, recente, confianca: c.confianca })
  await admin.from('revisao_itens').update({
    resposta, rascunho: null, resultado: c.resultado, credito: c.credito, confianca: c.confianca, pendente: false, incerta: !!incerta,
    previsto: Math.round(previsto * 1000) / 1000, retencao_antes: retencaoAntes === null ? null : Math.round(retencaoAntes * 1000) / 1000,
    recente, pontos, segundos: item.segundos + seg, respondida_em: agora.toISOString(),
  }).eq('id', item.id).eq('usuario_id', usuarioId)

  if (alta && item.questao_id) {
    const out = atualizar(aluno, { tipo: item.tipo, alternativas: nAlternativas, b, m: questao?.respostas_b ?? 0 }, { resultado: c.resultado, dicas: item.dicas_usadas })
    await admin.from('questoes').update({ dificuldade_b: Math.round(out.questao.b * 1000) / 1000, respostas_b: out.questao.m }).eq('id', item.questao_id).eq('usuario_id', usuarioId)
    const novo = revisar(cartao ? { S: cartao.estabilidade, D: cartao.dificuldade, ultimo: cartao.ultimo_dia, reps: cartao.repeticoes } : null, notaDaResposta(c.resultado, item.dicas_usadas, !!incerta), dia)
    await admin.from('questao_cartoes').upsert({
      questao_id: item.questao_id, usuario_id: usuarioId, estabilidade: novo.S, dificuldade: novo.D, ultimo_dia: dia, repeticoes: novo.reps,
      proxima: dataDoDia(dia + proximaRevisaoEmDias(novo.S)), ultimo_resultado: c.resultado, respondida_em: agora.toISOString(),
    }, { onConflict: 'questao_id' })
    if (item.assunto_id) {
      await admin.from('proficiencias').upsert({ assunto_id: item.assunto_id, usuario_id: usuarioId, theta: out.aluno.theta, n: out.aluno.n, atualizado_em: agora.toISOString() }, { onConflict: 'assunto_id' })
    }
  }
  await atualizarContagem(admin, usuarioId, revisao.id)
  return { resultado: c.resultado, pontos }
}

export async function atualizarContagem(admin, usuarioId, revisaoId, extra = {}) {
  const { data: itens } = await admin.from('revisao_itens').select('resultado, incerta, segundos').eq('revisao_id', revisaoId).eq('usuario_id', usuarioId)
  const l = itens ?? []
  await admin.from('revisoes').update({
    respondidas: l.filter((i) => i.resultado).length,
    certas: l.filter((i) => i.resultado === 'correta').length,
    parciais: l.filter((i) => i.resultado === 'parcial').length,
    erradas: l.filter((i) => i.resultado === 'incorreta').length,
    incertas: l.filter((i) => i.resultado === 'correta' && i.incerta).length,
    segundos: l.reduce((s, i) => s + (i.segundos ?? 0), 0),
    atualizado_em: new Date().toISOString(),
    ...extra,
  }).eq('id', revisaoId).eq('usuario_id', usuarioId)
}

// Rascunhos enviados na pausa: { itemId: { resposta: {...}, incerta } }. Só questões desta revisão ainda não
// enviadas; cada um com no máximo 6 mil caracteres. O resto é ignorado.
export function lerRascunhos(entrada, itens) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return []
  const abertos = new Map(itens.filter((i) => !i.resultado && !i.pendente).map((i) => [i.id, i]))
  const saida = []
  for (const [id, r] of Object.entries(entrada)) {
    if (!abertos.has(id) || !r || typeof r !== 'object') continue
    const resposta = r.resposta && typeof r.resposta === 'object' && !Array.isArray(r.resposta) ? r.resposta : {}
    const rascunho = { resposta, incerta: r.incerta === true }
    if (JSON.stringify(rascunho).length > 6000) continue
    saida.push([id, rascunho])
  }
  return saida
}

export const letraDe = (p) => LETRAS[p] ?? ''
