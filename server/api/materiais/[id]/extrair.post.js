// POST /api/materiais/:id/extrair
// Lê o arquivo do bucket privado, separa em trechos, acha conceitos e calcula a análise (sem IA).
// Grava uma versão nova com páginas, trechos e conceitos e deixa o material "aguardando conferência".
// Tudo roda com a sessão da pessoa: o banco (RLS) só deixa ler e gravar o que é dela.
// Nunca registra o texto do material em log.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { extrairMaterial } from '../../../utils/extracao.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })

  const id = getRouterParam(event, 'id')
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Material inválido.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const assuntoId = UUID.test(corpo.assuntoId ?? '') ? corpo.assuntoId : null

  const supabase = await serverSupabaseClient(event)
  const { data: material } = await supabase.from('materiais').select('id, formato, arquivo_caminho, status').eq('id', id).maybeSingle()
  if (!material) throw createError({ statusCode: 404, statusMessage: 'Material não encontrado.' })
  if (!['enviando', 'extraindo', 'erro'].includes(material.status)) return { status: material.status }
  return extrairMaterial(supabase, material, assuntoId)
})
