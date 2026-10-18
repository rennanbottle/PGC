// GET /api/fontes/pagina?fonte=wikilivros&titulo=Python/Listas
// Prévia de uma página aberta antes de trazer: seções (título, começo do texto, tamanho), endereço e licença.
// O texto inteiro só é baixado de novo na hora de trazer (POST /api/materiais/wikipedia).
import { serverSupabaseUser } from '#supabase/server'
import { AGENTE, FONTES_WIKI, LICENCA_WIKIPEDIA, enderecoArtigo, enderecoPagina, resumoDoTexto, secoesDoExtrato } from '#shared/regras/wikipedia.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const q = getQuery(event)
  const fonte = FONTES_WIKI[q.fonte] ? String(q.fonte) : 'wikipedia'
  const titulo = String(q.titulo ?? '').trim().slice(0, 200)
  if (!titulo) throw createError({ statusCode: 400, statusMessage: 'Escolha uma página.' })
  let pagina
  try {
    const r = await fetch(enderecoArtigo(titulo, fonte), { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) })
    if (!r.ok) throw new Error(String(r.status))
    pagina = (await r.json())?.query?.pages?.[0]
  }
  catch {
    throw createError({ statusCode: 502, statusMessage: `${FONTES_WIKI[fonte].nome} não respondeu agora. Tente de novo.` })
  }
  if (!pagina || pagina.missing) throw createError({ statusCode: 404, statusMessage: 'Essa página não existe mais. Escolha outra.' })
  const secoes = secoesDoExtrato(pagina.extract).slice(0, 40).map((s) => ({ titulo: s.titulo, palavras: s.palavras, resumo: resumoDoTexto(s.texto, 260) }))
  return {
    fonte,
    titulo: pagina.title,
    endereco: String(pagina.fullurl ?? enderecoPagina(pagina.title, fonte)),
    licenca: LICENCA_WIKIPEDIA,
    palavras: secoes.reduce((s, x) => s + x.palavras, 0),
    secoes,
  }
})
