// POST /api/conjuntos  Corpo: { nome, blocos }. Salva um conjunto de estudo (só o modelo; nada é sorteado aqui).
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { lerNomeConjunto } from '#shared/regras/conjuntos.js'
import { lerConjunto } from '../../utils/montarConjunto.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const supabase = await serverSupabaseClient(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const n = lerNomeConjunto(corpo.nome)
  if (n.erro) throw createError({ statusCode: 400, statusMessage: n.erro })
  const { blocos } = await lerConjunto(supabase, corpo.blocos)
  const { data, error } = await supabase.from('conjuntos').insert({ nome: n.nome, blocos }).select('id, atualizado_em').single()
  if (error) throw createError({ statusCode: error.code === 'P0001' ? 409 : 500, statusMessage: error.code === 'P0001' ? error.message : 'Não deu para salvar o conjunto.' })
  return { id: data.id, atualizadoEm: data.atualizado_em }
})
