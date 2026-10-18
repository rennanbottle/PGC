// GET /api/fontes/tema?q=listas&materia=Python&assunto=Listas e tuplas&area=programacao&fonte=
// Procura um tema no Wikilivros, na Wikiversidade e na Wikipédia em português ao mesmo tempo, pensando na matéria:
// material didático primeiro, história e biografia descem em matérias técnicas, título com o assunto sobe.
// "fonte" (opcional) limita a um projeto. Devolve só título, trecho, tamanho, fonte e endereço.
import { serverSupabaseUser } from '#supabase/server'
import { AGENTE, FONTES_WIKI, ORDEM_FONTES, consultaDoTema, enderecoBusca, enderecoPagina, limparTrecho, ordenarResultados } from '#shared/regras/wikipedia.js'

const texto = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const q = getQuery(event)
  const contexto = { tema: texto(q.q, 100), materia: texto(q.materia, 80), assunto: texto(q.assunto, 120), area: texto(q.area, 20) }
  const consulta = consultaDoTema(contexto)
  if (consulta.length < 2) return { consulta, resultados: [] }
  const fontes = FONTES_WIKI[q.fonte] ? [String(q.fonte)] : ORDEM_FONTES

  const respostas = await Promise.allSettled(fontes.map(async (fonte) => {
    const r = await fetch(enderecoBusca(consulta, 6, fonte), { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(String(r.status))
    const dados = await r.json()
    return (dados?.query?.search ?? []).map((a) => ({
      fonte,
      titulo: a.title,
      trecho: limparTrecho(a.snippet),
      palavras: a.wordcount ?? 0,
      endereco: enderecoPagina(a.title, fonte),
    }))
  }))
  if (respostas.every((r) => r.status === 'rejected')) {
    throw createError({ statusCode: 502, statusMessage: 'As fontes abertas não responderam agora. Tente de novo em instantes.' })
  }
  const todos = respostas.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  return { consulta, resultados: ordenarResultados(todos, contexto, 8) }
})
