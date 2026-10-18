// POST /api/provas/:id/guardar
// Guarda a resposta de uma questão (sem corrigir), a marca de voltar, o tempo gasto nela e a questão aberta.
// Corpo: { itemId, resposta?, marcada?, segundos?, atual? }. Prova entregue ou com o tempo acabado: { entregue }.
import { pessoa } from '../../../utils/revisoes.js'
import { entregarProva, tempoAcabou } from '../../../utils/provas.js'
import { UUID } from '../../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const id = getRouterParam(event, 'id')
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (!UUID.test(id ?? '') || !UUID.test(corpo.itemId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Pedido inválido.' })
  const { data: revisao } = await admin.from('revisoes').select('id, tipo, status, termina_em, pausada_em').eq('id', id).eq('usuario_id', usuario.sub).maybeSingle()
  if (!revisao || revisao.tipo !== 'prova') throw createError({ statusCode: 404, statusMessage: 'Prova não encontrada.' })
  if (revisao.status !== 'em_andamento') return { entregue: true }
  if (tempoAcabou(revisao)) {
    await entregarProva({ admin, supabase, usuarioId: usuario.sub, revisao, porTempo: true })
    return { entregue: true }
  }
  const { data: item } = await admin.from('revisao_itens').select('id, segundos').eq('id', corpo.itemId).eq('revisao_id', id).eq('usuario_id', usuario.sub).maybeSingle()
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada nesta prova.' })
  const mudar = {}
  if (corpo.resposta && typeof corpo.resposta === 'object' && !Array.isArray(corpo.resposta)) {
    const rascunho = { resposta: corpo.resposta }
    if (JSON.stringify(rascunho).length > 6000) throw createError({ statusCode: 413, statusMessage: 'Resposta grande demais.' })
    mudar.rascunho = Object.keys(corpo.resposta).length ? rascunho : null
  }
  if (typeof corpo.marcada === 'boolean') mudar.marcada = corpo.marcada
  const seg = Math.max(0, Math.min(3600, Math.round(Number(corpo.segundos) || 0)))
  if (seg) mudar.segundos = (item.segundos ?? 0) + seg
  if (Object.keys(mudar).length) await admin.from('revisao_itens').update(mudar).eq('id', item.id).eq('usuario_id', usuario.sub)
  const atual = Number.isInteger(corpo.atual) && corpo.atual >= 0 && corpo.atual < 60 ? corpo.atual : null
  await admin.from('revisoes').update({ ...(atual !== null ? { atual } : {}), atualizado_em: new Date().toISOString() }).eq('id', id).eq('usuario_id', usuario.sub)
  return { ok: true }
})
