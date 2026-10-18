// GET /api/provas
// As provas da pessoa (a em andamento e as entregues, da mais nova para a mais velha) e as provas marcadas na
// Agenda daqui para a frente, para montar um simulado antes.
import { pessoa } from '../../utils/revisoes.js'
import { porcentagemDe, restanteDe } from '../../utils/provas.js'

export default defineEventHandler(async (event) => {
  const { supabase } = await pessoa(event)
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [{ data: lista }, { data: agenda }] = await Promise.all([
    supabase.from('revisoes').select('id, titulo, status, total, certas, segundos, prova, termina_em, criado_em, concluida_em, resultado->nota')
      .eq('tipo', 'prova').order('criado_em', { ascending: false }).limit(60),
    supabase.from('agenda_eventos').select('id, titulo, data').eq('tipo', 'prova').is('concluido_em', null).gte('data', hoje).order('data').limit(5),
  ])
  const provas = []
  for (const p of lista ?? []) {
    if (p.status === 'concluida') {
      const usados = Math.round((new Date(p.concluida_em).getTime() - new Date(p.criado_em).getTime()) / 1000)
      provas.push({
        id: p.id, titulo: p.titulo, formato: p.prova?.formato ?? 'enem', status: 'entregue', total: p.total,
        certas: p.nota?.certas ?? p.certas ?? 0, porcentagem: porcentagemDe({ resultado: { nota: p.nota } }),
        segundos: Math.max(0, Math.min((p.prova?.minutos ?? 0) * 60 || usados, usados)), minutos: p.prova?.minutos ?? 0, entregueEm: p.concluida_em,
        assuntoId: p.prova?.assuntoId ?? null,
      })
    }
    else if (p.status === 'em_andamento') {
      const { count } = await supabase.from('revisao_itens').select('id', { count: 'exact', head: true }).eq('revisao_id', p.id).not('rascunho', 'is', null)
      provas.push({ id: p.id, titulo: p.titulo, formato: p.prova?.formato ?? 'enem', status: 'em_andamento', total: p.total, respondidas: count ?? 0, restante: restanteDe(p) })
    }
  }
  return { provas, agendadas: agenda ?? [] }
})
