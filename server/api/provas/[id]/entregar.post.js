// POST /api/provas/:id/entregar
// Entrega a prova: corrige tudo de uma vez, dá os pontos e fecha. Pedir de novo depois de entregue não faz nada.
import { pessoa } from '../../../utils/revisoes.js'
import { entregarProva, provaEmDia, restanteDe } from '../../../utils/provas.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const { revisao } = await provaEmDia({ admin, supabase, usuarioId: usuario.sub, id: getRouterParam(event, 'id') })
  // "Pelo tempo" só vale se o relógio do servidor também estiver no fim (meio minuto de folga).
  const porTempo = corpo.porTempo === true && revisao.termina_em && restanteDe(revisao) <= 30
  const r = await entregarProva({ admin, supabase, usuarioId: usuario.sub, revisao, porTempo })
  return { ok: true, entregando: !!r.entregando }
})
