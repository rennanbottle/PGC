// GET /api/materiais/:id/extras
// O que o PGC tira do texto sem IA, para a página do texto: glossário (definições achadas), linha do tempo (frases
// com data, em ordem) e os textos da pessoa mais parecidos com este (pelos termos mais frequentes).
import { glossario, linhaDoTempo, textosParecidos } from '#shared/regras/biblioteca.js'
import { pessoa } from '../../../utils/revisoes.js'
import { UUID } from '../../../utils/consultas.js'

const ultimaVersao = (versoes = []) => [...versoes].sort((a, b) => b.numero - a.numero)[0] ?? null

export default defineEventHandler(async (event) => {
  const { supabase } = await pessoa(event)
  const id = String(getRouterParam(event, 'id') ?? '')
  if (!UUID.test(id)) throw createError({ statusCode: 404, statusMessage: 'Texto não encontrado.' })

  const { data: textos, error } = await supabase.from('materiais')
    .select('id, titulo, materia_id, arquivado_em, material_versoes(id, numero, frequencias:analise->frequencias)')
    .limit(400)
  if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para ler o texto agora.' })
  const atual = (textos ?? []).find((t) => t.id === id)
  if (!atual) throw createError({ statusCode: 404, statusMessage: 'Texto não encontrado.' })
  const versao = ultimaVersao(atual.material_versoes)
  if (!versao) return { glossario: [], linha: [], parecidos: [] }

  const [{ data: trechos }, { data: conceitos }] = await Promise.all([
    supabase.from('material_trechos').select('tipo, texto, pagina, usar_em_questoes').eq('versao_id', versao.id).order('ordem').limit(3000),
    supabase.from('conceitos').select('tipo, termo, definicao, pagina, status').eq('versao_id', versao.id).eq('tipo', 'definicao').limit(500),
  ])

  const outros = (textos ?? [])
    .filter((t) => t.id !== id && !t.arquivado_em)
    .map((t) => ({ id: t.id, titulo: t.titulo, materiaId: t.materia_id, frequencias: Array.isArray(ultimaVersao(t.material_versoes)?.frequencias) ? ultimaVersao(t.material_versoes).frequencias : [] }))

  return {
    glossario: glossario(conceitos ?? []),
    linha: linhaDoTempo(trechos ?? []),
    parecidos: textosParecidos(Array.isArray(versao.frequencias) ? versao.frequencias : [], outros),
  }
})
