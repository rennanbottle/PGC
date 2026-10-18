// GET /api/provas/:id/resultado
// Resultado da prova entregue: cada questão com a resposta e a certa (para o cartão-resposta conferido), as
// correções (sua resposta, a certa, o erro da alternativa e a explicação), a prova anterior do mesmo formato para
// comparar, as últimas notas, os pontos e o nível. A nota é calculada na tela com shared/regras/provas.js.
// Na prova de domínio vem também "dominio": o assunto, a regra e se passou (o estado novo está em resultado.assuntos).
import { corrigir, paraResponder, textoDaCerta, textoDaResposta } from '#shared/regras/sessao.js'
import { pessoa } from '../../../utils/revisoes.js'
import { assuntosDaProva, porcentagemDe, provaEmDia } from '../../../utils/provas.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const { revisao, itens } = await provaEmDia({ admin, supabase, usuarioId: usuario.sub, id: getRouterParam(event, 'id') })
  if (revisao.status === 'pausada') throw createError({ statusCode: 409, statusMessage: 'A prova está sendo corrigida. Atualize a página em alguns segundos.' })
  if (revisao.status !== 'concluida') throw createError({ statusCode: 409, statusMessage: 'A prova ainda não foi entregue.' })
  const formato = revisao.prova?.formato ?? 'enem'
  const [{ data: anteriores }, { data: ultimas }] = await Promise.all([
    admin.from('revisoes').select('concluida_em, resultado->nota').eq('usuario_id', usuario.sub).eq('tipo', 'prova').eq('status', 'concluida')
      .eq('prova->>formato', formato).lt('concluida_em', revisao.concluida_em).order('concluida_em', { ascending: false }).limit(1),
    admin.from('revisoes').select('resultado->nota').eq('usuario_id', usuario.sub).eq('tipo', 'prova').eq('status', 'concluida')
      .lte('concluida_em', revisao.concluida_em).order('concluida_em', { ascending: false }).limit(8),
  ])
  const ehDominio = formato === 'dominio'
  const anterior = !ehDominio && anteriores?.[0] ? { porcentagem: porcentagemDe({ resultado: { nota: anteriores[0].nota } }), entregueEm: anteriores[0].concluida_em } : null
  const usados = Math.round((new Date(revisao.concluida_em).getTime() - new Date(revisao.criado_em).getTime()) / 1000)
  const minutos = revisao.prova?.minutos ?? 0
  return {
    prova: {
      id: revisao.id, titulo: revisao.titulo, formato, total: itens.length, entregueEm: revisao.concluida_em,
      segundos: Math.max(0, minutos ? Math.min(minutos * 60, usados) : usados), minutos, porTempo: !!revisao.entregue_por_tempo,
    },
    assuntos: await assuntosDaProva(supabase, itens),
    itens: itens.map((i) => {
      const resposta = i.resposta ?? {}
      const c = corrigir(i.snapshot, i.semente, resposta)
      return {
        id: i.id, ordem: i.ordem, tipo: i.tipo, assuntoId: i.assunto_id, questao: paraResponder(i.snapshot, i.semente), resposta,
        correcao: { resultado: i.resultado ?? 'em_branco', detalhe: c.detalhe ?? {} }, segundos: i.segundos ?? 0,
      }
    }),
    correcoes: itens.map((i) => {
      const q = i.snapshot
      const c = i.resultado ? corrigir(q, i.semente, i.resposta ?? {}) : null
      return {
        id: i.id, ordem: i.ordem, tipo: i.tipo, nivel: i.nivel, assuntoId: i.assunto_id, questaoId: i.questao_id, enunciado: q.enunciado,
        resultado: i.resultado ?? 'em_branco', sua: i.resultado ? textoDaResposta(q, i.semente, i.resposta ?? {}) : '', certa: textoDaCerta(q, i.semente),
        erro: c?.detalhe?.erro ?? null, explicacao: q.explicacao ?? null, segundos: i.segundos ?? 0,
      }
    }),
    anterior,
    serie: (ultimas ?? []).map((u) => porcentagemDe({ resultado: { nota: u.nota } })).reverse(),
    pontos: { total: revisao.pontos ?? 0, detalhe: revisao.pontos_detalhe ?? [] },
    nivel: revisao.resultado?.nivel ?? null,
    dominio: ehDominio
      ? {
          assuntoId: revisao.prova?.assuntoId ?? null,
          regra: revisao.prova?.regra ?? null,
          aprovada: !!revisao.resultado?.dominio?.aprovada,
          certas: revisao.resultado?.dominio?.certas ?? 0,
          minimo: revisao.resultado?.dominio?.minimo ?? revisao.prova?.regra?.minimoCertas ?? 0,
          estadoDepois: (revisao.resultado?.assuntos ?? []).find((a) => a.id === revisao.prova?.assuntoId)?.estadoDepois ?? null,
        }
      : null,
  }
})
