// GET /api/wikipedia/buscar?q=queda livre
// Procura artigos na Wikipédia em português para a pessoa que não tem material. Só devolve título, trecho e tamanho.
import { serverSupabaseUser } from '#supabase/server'
import { AGENTE, enderecoBusca, limparTrecho } from '#shared/regras/wikipedia.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const termo = String(getQuery(event).q ?? '').trim().slice(0, 100)
  if (termo.length < 3) return { artigos: [] }
  let dados
  try {
    const r = await fetch(enderecoBusca(termo), { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(String(r.status))
    dados = await r.json()
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: 'A Wikipédia não respondeu agora. Tente de novo.' })
  }
  return {
    artigos: (dados?.query?.search ?? []).map((a) => ({ titulo: a.title, trecho: limparTrecho(a.snippet), palavras: a.wordcount })),
  }
})
