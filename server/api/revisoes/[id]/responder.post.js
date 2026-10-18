// POST /api/revisoes/:id/responder
// Corpo: { itemId, resposta, incerta, segundos }. Corrige no servidor, guarda, atualiza a dificuldade da questão,
// o cartão de repetição espaçada e a proficiência do assunto. Cartão, resposta curta e explicar respondem em dois
// passos: primeiro a pessoa escreve (volta o que revelar), depois se avalia.
import { blocosDaExecucao, configDoBloco } from '#shared/regras/conjuntos.js'
import { blocosCompletos, carregarRevisao, correcaoDoItem, itemParaTela, pessoa, registrarResposta } from '../../../utils/revisoes.js'
import { UUID } from '../../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const { usuario, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (!UUID.test(corpo.itemId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Questão inválida.' })
  const resposta = corpo.resposta && typeof corpo.resposta === 'object' ? corpo.resposta : {}
  if (JSON.stringify(resposta).length > 20000) throw createError({ statusCode: 413, statusMessage: 'Resposta grande demais.' })
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  if (revisao.status === 'concluida') throw createError({ statusCode: 409, statusMessage: 'Esta revisão já terminou.' })
  const item = itens.find((i) => i.id === corpo.itemId)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada nesta revisão.' })
  if (item.resultado) throw createError({ statusCode: 409, statusMessage: 'Esta questão já foi respondida.' })
  const blocos = blocosDaExecucao(revisao)
  if (blocos[item.bloco ?? 0]?.esgotado) throw createError({ statusCode: 409, statusMessage: 'O tempo deste bloco acabou.' })
  if (itens.some((i) => (i.bloco ?? 0) < (item.bloco ?? 0) && !i.resultado && !blocos[i.bloco ?? 0]?.esgotado)) throw createError({ statusCode: 409, statusMessage: 'Os blocos vão em ordem. Termine o bloco anterior antes.' })

  const r = await registrarResposta({ admin, usuarioId: usuario.sub, revisao, item, resposta, incerta: corpo.incerta === true, segundos: corpo.segundos })
  if (revisao.status === 'pausada') await admin.from('revisoes').update({ status: 'em_andamento', pausada_em: null }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
  if (r.pendente) return { pendente: true, revelar: r.revelar }
  const { data: atualizado } = await admin.from('revisao_itens').select('*').eq('id', item.id).eq('usuario_id', usuario.sub).single()
  // Correção conforme o bloco: a cada questão, no fim do bloco (quando esta foi a última do bloco) ou no fim de tudo.
  const correcao = configDoBloco(revisao, item.bloco ?? 0).correcao
  if (correcao === 'fim') return { item: await itemParaTela(admin, usuario.sub, revisao, atualizado, { comCorrecao: false }) }
  if (correcao === 'bloco') {
    const { itens: todos } = await carregarRevisao(admin, usuario.sub, revisao.id)
    if (!blocosCompletos(todos).has(item.bloco ?? 0)) return { item: await itemParaTela(admin, usuario.sub, revisao, atualizado, { comCorrecao: false }) }
    return { item: { ...(await itemParaTela(admin, usuario.sub, revisao, atualizado, { comCorrecao: true })), correcao: await correcaoDoItem(admin, usuario.sub, atualizado) }, blocoCompleto: true }
  }
  return { item: { ...(await itemParaTela(admin, usuario.sub, revisao, atualizado)), correcao: await correcaoDoItem(admin, usuario.sub, atualizado) } }
})
