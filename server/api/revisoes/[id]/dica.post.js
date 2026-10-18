// POST /api/revisoes/:id/dica  Corpo: { itemId }. Abre o próximo degrau de dica (cada um tira 25% dos pontos).
import { dicas } from '#shared/regras/sessao.js'
import { carregarRevisao, dicasPermitidas, pessoa, trechoDe } from '../../../utils/revisoes.js'
import { UUID } from '../../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const { usuario, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (!UUID.test(corpo.itemId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Questão inválida.' })
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  const item = itens.find((i) => i.id === corpo.itemId)
  if (!item || revisao.status === 'concluida') throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada.' })
  if (item.resultado || item.pendente) throw createError({ statusCode: 409, statusMessage: 'A questão já foi respondida.' })
  const lista = dicas(item.snapshot, item.semente, { trecho: await trechoDe(admin, usuario.sub, item.snapshot.trecho_id) })
  const limite = Math.min(dicasPermitidas(revisao, item), lista.length)
  if (item.dicas_usadas >= limite) throw createError({ statusCode: 409, statusMessage: limite ? 'Não há mais dicas para esta questão.' : 'Esta questão não tem dica.' })
  const usadas = item.dicas_usadas + 1
  await admin.from('revisao_itens').update({ dicas_usadas: usadas }).eq('id', item.id).eq('usuario_id', usuario.sub)
  return { dicas: lista.slice(0, usadas), dicasUsadas: usadas }
})
