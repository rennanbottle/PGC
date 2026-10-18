// GET /api/provas/:id/config
// A configuração de uma prova, para montar outra igual ("Fazer de novo").
import { pessoa } from '../../../utils/revisoes.js'
import { UUID } from '../../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const { usuario, admin } = await pessoa(event)
  const id = getRouterParam(event, 'id')
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Prova inválida.' })
  const { data: r } = await admin.from('revisoes').select('titulo, total, tipo, prova').eq('id', id).eq('usuario_id', usuario.sub).maybeSingle()
  if (!r || r.tipo !== 'prova') throw createError({ statusCode: 404, statusMessage: 'Prova não encontrada.' })
  const p = r.prova ?? {}
  return { titulo: r.titulo, formato: p.formato, assuntos: p.assuntos ?? [], quantas: p.quantas ?? r.total, minutos: p.minutos, relogio: p.relogio, ordem: p.ordem, fracos: p.fracos !== false }
})
