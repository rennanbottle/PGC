// POST /api/revisoes/:id/concluir  Corpo: { encerrar?: true }.
// Fecha a revisão: bônus, estado de cada assunto, marcos, teto do dia e resumo. "encerrar" fecha mesmo com questões
// em branco (as respondidas contam).
import { blocosDaExecucao } from '#shared/regras/conjuntos.js'
import { concluirRevisao } from '../../../utils/concluir.js'
import { carregarRevisao, pessoa } from '../../../utils/revisoes.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  if (revisao.status === 'concluida') return { id: revisao.id, pontos: revisao.pontos }
  const esgotados = blocosDaExecucao(revisao).map((b) => !!b.esgotado)
  const faltam = itens.filter((i) => !i.resultado && !esgotados[i.bloco ?? 0]).length
  const blocoNaoAberto = blocosDaExecucao(revisao).findIndex((b) => b.preparado === false)
  if (blocoNaoAberto >= 0 && corpo.encerrar !== true) throw createError({ statusCode: 409, statusMessage: `Falta o bloco ${blocoNaoAberto + 1}. Passe para ele ou encerre.` })
  if (faltam && corpo.encerrar !== true) throw createError({ statusCode: 409, statusMessage: `Faltam ${faltam} ${faltam === 1 ? 'questão' : 'questões'}. Responda ou encerre.` })
  const r = await concluirRevisao({ admin, supabase, usuarioId: usuario.sub, revisao, itens, encerrar: corpo.encerrar === true })
  return { id: revisao.id, ...r }
})
