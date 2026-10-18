// GET /api/metas
// As metas ativas da pessoa com o progresso contado agora: questões respondidas, minutos, estudos concluídos (no
// período de cada meta, pelo dia de Brasília) e assuntos dominados (estado atual). Também manda a meta do dia, que
// vem do ritmo. A meta com data que chega ao alvo ganha "batida_em" (gravado aqui, pelo servidor).
import { RITMOS, RITMO_PADRAO } from '#shared/regras/ritmo.js'
import { diaDeHoje, diaDoInstante } from '#shared/regras/agenda.js'
import { ordenarMetas, periodoDaMeta, progressoDaMeta, situacaoDaMeta } from '#shared/regras/metas.js'
import { pessoa } from '../../utils/revisoes.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const hoje = diaDeHoje()
  const [{ data: perfil }, { data: metas, error }] = await Promise.all([
    supabase.from('perfis').select('ritmo').eq('id', usuario.sub).maybeSingle(),
    supabase.from('metas').select('id, tipo, alvo, periodo, inicio, prazo, materia_id, batida_em, criado_em').is('arquivada_em', null).order('criado_em').limit(40),
  ])
  if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para ler as metas agora.' })
  const ritmo = RITMOS[perfil?.ritmo] ? perfil.ritmo : RITMO_PADRAO

  // Desde quando contar: o começo mais antigo entre os períodos (e hoje, para a meta do dia).
  const inicios = (metas ?? []).filter((m) => m.tipo !== 'dominar').map((m) => periodoDaMeta(m, hoje).inicio)
  const desde = [hoje, ...inicios].sort()[0]
  const temDominar = (metas ?? []).some((m) => m.tipo === 'dominar')
  const [{ data: itens }, { data: estudos }, { data: dominados }] = await Promise.all([
    supabase.from('revisao_itens').select('revisao_id, materia_id, segundos, respondida_em')
      .not('respondida_em', 'is', null).gte('respondida_em', `${desde}T00:00:00-03:00`).limit(20000),
    supabase.from('revisoes').select('id').eq('status', 'concluida').gte('concluida_em', `${desde}T00:00:00-03:00`).limit(5000),
    temDominar ? supabase.from('proficiencias').select('assunto_id, assuntos!inner(materia_id, arquivado_em)').eq('estado', 'dominado').is('assuntos.arquivado_em', null).limit(5000) : { data: [] },
  ])
  const dados = {
    respostas: (itens ?? []).map((i) => ({ dia: diaDoInstante(i.respondida_em), materia_id: i.materia_id, segundos: i.segundos ?? 0, revisao_id: i.revisao_id })),
    estudosConcluidos: new Set((estudos ?? []).map((e) => e.id)),
    dominados: (dominados ?? []).map((d) => ({ materia_id: d.assuntos?.materia_id ?? null })),
  }

  const lista = []
  for (const m of metas ?? []) {
    // Meta com data que já foi batida continua batida, mesmo que um assunto deixe de estar dominado depois.
    const feito = progressoDaMeta(m, dados, hoje)
    const situacao = situacaoDaMeta(m, m.periodo === 'data' && m.batida_em ? Math.max(feito, m.alvo) : feito, hoje)
    // Meta com data batida fica marcada (o servidor grava; a pessoa não pode mudar esse campo).
    if (m.periodo === 'data' && situacao.estado === 'batida' && !m.batida_em) {
      m.batida_em = new Date().toISOString()
      await admin.from('metas').update({ batida_em: m.batida_em }).eq('id', m.id).eq('usuario_id', usuario.sub)
    }
    lista.push({ ...m, situacao })
  }

  return {
    hoje,
    diaria: { feitas: dados.respostas.filter((r) => r.dia === hoje).length, meta: RITMOS[ritmo].metaDiariaQuestoes, ritmo: RITMOS[ritmo].nome },
    metas: ordenarMetas(lista),
  }
})
