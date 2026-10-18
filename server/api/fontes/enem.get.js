// GET /api/fontes/enem?ano=2022&area=matematica&lingua=ingles
// Lista as questões de uma prova do Enem (resumo: número, área, começo do texto, se tem figura e, quando não dá
// para importar, o motivo). A prova inteira fica guardada no servidor por algumas horas.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { ANOS_ENEM, AREAS_ENEM, resumoEnem } from '#shared/regras/enem.js'
import { provaDoEnem } from '../../utils/enem.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const q = getQuery(event)
  const ano = Number(q.ano)
  if (!ANOS_ENEM.includes(ano)) throw createError({ statusCode: 400, statusMessage: 'Escolha um ano entre 2009 e 2023.' })
  const area = AREAS_ENEM.some((a) => a.id === q.area) ? q.area : null
  const lingua = q.lingua === 'espanhol' ? 'espanhol' : 'ingles'

  const prova = await provaDoEnem(ano)
  const supabase = await serverSupabaseClient(event)
  const { data: jaTem } = await supabase.from('questoes').select('chave').like('chave', `enem:${ano}:%`).limit(1000)
  const importadas = new Set((jaTem ?? []).map((x) => x.chave))
  const questoes = prova
    .map(resumoEnem)
    .filter((r) => (!area || r.area === area) && (!r.lingua || r.lingua === lingua))
    .map((r) => ({ ...r, importada: importadas.has(r.chave) }))
  return { ano, questoes }
})
