// POST /api/revisoes/:id/comentario
// Comentário da IA sobre a execução que terminou. Só depois do fim, uma vez por execução (se falhar, dá para pedir
// de novo). Conta 1 das 30 operações de IA do dia, a menos que esta execução já tenha usado a IA para gerar
// questões: as duas coisas valem uma operação só. Usa só serviços que não treinam com os dados, e nada do texto
// enviado ou recebido é guardado além do próprio comentário.
import { montarPedidoComentario, validarComentario } from '#shared/regras/comentario.js'
import { blocosDaExecucao } from '#shared/regras/conjuntos.js'
import { textoDaCerta, textoDaResposta, corrigir } from '#shared/regras/sessao.js'
import { FalhaCascata, executarCascata, explicarFalha, nomeDoModelo } from '../../../utils/ia.js'
import { carregarRevisao, pessoa, trechoDe } from '../../../utils/revisoes.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const { revisao, itens } = await carregarRevisao(admin, usuario.sub, getRouterParam(event, 'id'))
  if (revisao.status !== 'concluida') throw createError({ statusCode: 409, statusMessage: 'O comentário vem só no fim.' })
  if (revisao.comentario?.texto) return { status: 'pronto', comentario: revisao.comentario }
  const respondidos = itens.filter((i) => i.resultado)
  if (respondidos.length < 3) return { status: 'falhou', motivo: 'Com menos de 3 respostas não há o que comentar.' }

  // Cota: a geração de questões desta execução e o comentário contam juntos.
  let geracaoId = null
  if (!revisao.geracao_id) {
    const materiaId = itens.find((i) => i.materia_id)?.materia_id
    if (!materiaId) return { status: 'falhou', motivo: 'As questões desta execução não têm matéria para registrar o uso.' }
    const { data: g, error } = await supabase.from('ia_geracoes').insert({ materia_id: materiaId, modo: 'ia', pedidas: 0, config: { tarefa: 'comentario', execucao: revisao.id } }).select('id').single()
    if (error) {
      if (error.code === 'P0001') return { status: 'falhou', motivo: error.message }
      throw createError({ statusCode: 500, statusMessage: 'Não deu para pedir o comentário agora.' })
    }
    geracaoId = g.id
  }

  const { data: nomes } = await supabase.from('assuntos').select('id, nome').in('id', [...new Set(itens.map((i) => i.assunto_id).filter(Boolean))])
  const nomeDe = Object.fromEntries((nomes ?? []).map((a) => [a.id, a.nome]))
  const erradas = respondidos.filter((i) => i.resultado !== 'correta').slice(0, 8)
  const erros = await Promise.all(erradas.map(async (i) => {
    const q = i.snapshot
    const c = corrigir(q, i.semente, i.resposta ?? {})
    const trecho = await trechoDe(admin, usuario.sub, q.trecho_id)
    return { assunto: nomeDe[i.assunto_id] ?? '', enunciado: q.enunciado, sua: textoDaResposta(q, i.semente, i.resposta ?? {}), certa: textoDaCerta(q, i.semente), erro: c?.detalhe?.erro ?? null, trecho }
  }))
  const r = revisao.resultado ?? {}
  const blocos = (r.porBloco ?? blocosDaExecucao(revisao).map((b) => ({ ...b, certas: revisao.certas, parciais: revisao.parciais, erradas: revisao.erradas, total: revisao.total })))
    .filter((b) => !b.pulado)
  const mensagens = montarPedidoComentario({ titulo: revisao.titulo, acerto: r.acerto ?? 0, mediaAnterior: r.mediaAnterior ?? null, incertas: r.incertas ?? 0, blocos, erros })

  const fim = async (status) => {
    if (geracaoId) await supabase.from('ia_geracoes').update({ status, concluido_em: new Date().toISOString() }).eq('id', geracaoId)
  }
  try {
    const resposta = await executarCascata(event, {
      tarefa: 'gabarito', permiteTreino: false, usuarioId: usuario.sub, maxTokens: 900, tempoMs: 30000, mensagens,
      validar: validarComentario,
    })
    const comentario = { texto: resposta.valor, modelo: nomeDoModelo(resposta.modelo), em: new Date().toISOString() }
    await admin.from('revisoes').update({ comentario }).eq('id', revisao.id).eq('usuario_id', usuario.sub)
    await fim('concluida')
    return { status: 'pronto', comentario }
  }
  catch (erro) {
    await fim('falhou')
    if (!(erro instanceof FalhaCascata)) throw erro
    return { status: 'falhou', motivo: explicarFalha(erro.tentativas) }
  }
})
