// GET /api/revisoes/:id/resultado
// Resultado completo: resumo, pontos item por item, assuntos antes e depois, destaques e a correção de cada questão
// (a sua resposta, a certa, o erro que a sua alternativa representa, a explicação e o trecho do material).
import { textoDaCerta, textoDaResposta, corrigir } from '#shared/regras/sessao.js'
import { blocosDaExecucao } from '#shared/regras/conjuntos.js'
import { carregarRevisao, pessoa, trechoDe } from '../../../utils/revisoes.js'

export default defineEventHandler(async (event) => {
  const { usuario, admin } = await pessoa(event)
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  if (revisao.status !== 'concluida') throw createError({ statusCode: 409, statusMessage: 'A revisão ainda não terminou.' })
  // Execuções anteriores do mesmo conjunto, para comparar.
  let doConjunto = null
  if (revisao.conjunto_id) {
    const { data } = await admin.from('revisoes').select('id, certas, parciais, respondidas, criado_em').eq('usuario_id', usuario.sub).eq('conjunto_id', revisao.conjunto_id).eq('status', 'concluida').lte('criado_em', revisao.criado_em).order('criado_em', { ascending: false }).limit(8)
    const lista = (data ?? []).reverse().map((r) => (r.respondidas ? Math.round((100 * (r.certas + 0.5 * r.parciais)) / r.respondidas) : 0))
    doConjunto = { acertos: lista, execucoes: lista.length }
  }
  const correcoes = await Promise.all(itens.map(async (i) => {
    const q = i.snapshot
    const c = i.resultado ? corrigir(q, i.semente, i.resposta ?? {}) : null
    const trecho = i.resultado && i.resultado !== 'correta' ? await trechoDe(admin, usuario.sub, q.trecho_id) : null
    return {
      id: i.id, ordem: i.ordem, bloco: i.bloco ?? 0, tipo: i.tipo, nivel: i.nivel, bloom: i.bloom, assuntoId: i.assunto_id, questaoId: i.questao_id,
      enunciado: q.enunciado, resultado: i.resultado, incerta: i.incerta, dicas: i.dicas_usadas, pontos: i.pontos,
      sua: textoDaResposta(q, i.semente, i.resposta ?? {}), certa: textoDaCerta(q, i.semente),
      erro: c?.detalhe?.erro ?? null, explicacao: q.explicacao ?? null, trecho, segundos: i.segundos,
    }
  }))
  return {
    revisao: {
      id: revisao.id, titulo: revisao.titulo, modelo: revisao.modelo, total: revisao.total, respondidas: revisao.respondidas,
      certas: revisao.certas, parciais: revisao.parciais, erradas: revisao.erradas, incertas: revisao.incertas,
      pontos: revisao.pontos, pontosDetalhe: revisao.pontos_detalhe, resultado: revisao.resultado, segundos: revisao.segundos,
      concluidaEm: revisao.concluida_em, encerradaAntes: revisao.encerrada_antes, config: revisao.config,
      conjuntoId: revisao.conjunto_id, comentario: revisao.comentario?.texto ? revisao.comentario : null,
      blocos: blocosDaExecucao(revisao).map((b) => ({ tipo: b.tipo ?? 'revisao', nome: b.nome ?? revisao.titulo, pulado: !!b.pulado, correcao: b.config?.correcao ?? 'cada' })),
    },
    doConjunto,
    correcoes,
  }
})
