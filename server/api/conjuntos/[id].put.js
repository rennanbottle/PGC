// PUT /api/conjuntos/:id  Corpo: { nome, blocos }. Muda o conjunto. As execuções já feitas guardam a própria cópia.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { lerNomeConjunto } from '#shared/regras/conjuntos.js'
import { lerConjunto } from '../../utils/montarConjunto.js'
import { UUID } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const id = getRouterParam(event, 'id')
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Conjunto inválido.' })
  const supabase = await serverSupabaseClient(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const n = lerNomeConjunto(corpo.nome)
  if (n.erro) throw createError({ statusCode: 400, statusMessage: n.erro })
  const { blocos } = await lerConjunto(supabase, corpo.blocos)
  const { data, error } = await supabase.from('conjuntos').update({ nome: n.nome, blocos }).eq('id', id).select('id, atualizado_em').maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para salvar o conjunto.' })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Conjunto não encontrado.' })
  return { id: data.id, atualizadoEm: data.atualizado_em }
})
