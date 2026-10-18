// DELETE /api/conjuntos/:id  Apaga o conjunto. As execuções feitas com ele continuam no histórico, sem o vínculo.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { UUID } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const id = getRouterParam(event, 'id')
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Conjunto inválido.' })
  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase.from('conjuntos').delete().eq('id', id).select('id')
  if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para apagar o conjunto.' })
  if (!data?.length) throw createError({ statusCode: 404, statusMessage: 'Conjunto não encontrado.' })
  return { ok: true }
})
