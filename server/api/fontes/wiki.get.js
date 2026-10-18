// GET /api/fontes/wiki?fonte=wikipedia|wikilivros|wikiversidade&q=queda livre
// Procura páginas no projeto escolhido (em português). Só devolve título, trecho, tamanho e o endereço.
import { serverSupabaseUser } from '#supabase/server'
import { AGENTE, FONTES_WIKI, enderecoBusca, enderecoPagina, limparTrecho } from '#shared/regras/wikipedia.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const q = getQuery(event)
  const fonte = FONTES_WIKI[q.fonte] ? String(q.fonte) : 'wikipedia'
  const termo = String(q.q ?? '').trim().slice(0, 100)
  if (termo.length < 3) return { artigos: [] }
  let dados
  try {
    const r = await fetch(enderecoBusca(termo, 8, fonte), { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(String(r.status))
    dados = await r.json()
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: `${FONTES_WIKI[fonte].nome} não respondeu agora. Tente de novo.` })
  }
  return {
    artigos: (dados?.query?.search ?? []).map((a) => ({ titulo: a.title, trecho: limparTrecho(a.snippet), palavras: a.wordcount, endereco: enderecoPagina(a.title, fonte) })),
  }
})
