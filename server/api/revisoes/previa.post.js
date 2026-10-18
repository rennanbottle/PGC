// POST /api/revisoes/previa  Corpo: { blocos }.
// O que cada bloco vai ter, sem criar nada: quantas questões existem sem repetir as de outros blocos, quantas
// vencidas e novas, quanto falta (para completar com material ou IA), tempo estimado e os totais do conjunto.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { lerConjunto, previaConjunto } from '../../utils/montarConjunto.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const supabase = await serverSupabaseClient(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const { blocos } = await lerConjunto(supabase, corpo.blocos)
  return previaConjunto(supabase, blocos)
})
