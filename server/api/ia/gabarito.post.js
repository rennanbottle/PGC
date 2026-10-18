// POST /api/ia/gabarito
// Sugere o gabarito de uma questão importada sem resposta. Corpo: { questaoId }.
// A sugestão marca a letra, guarda o porquê e o modelo em conteudo.sugestaoIa e deixa o gabarito "não confirmado":
// a questão fica fora das revisões até a pessoa confirmar. Só usa serviços que não treinam com os dados.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { montarPedidoGabarito, validarGabarito } from '#shared/regras/ia.js'
import { FalhaCascata, executarCascata, explicarFalha, nomeDoModelo } from '../../utils/ia.js'
import { UUID } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (!UUID.test(corpo.questaoId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Questão inválida.' })

  const supabase = await serverSupabaseClient(event)
  const { data: q } = await supabase.from('questoes').select('id, enunciado, conteudo, gabarito_confirmado, materias(nome)').eq('id', corpo.questaoId).maybeSingle()
  if (!q) throw createError({ statusCode: 404, statusMessage: 'Questão não encontrada.' })
  const alternativas = q.conteudo?.alternativas ?? []
  if (alternativas.length < 2) throw createError({ statusCode: 409, statusMessage: 'A sugestão de gabarito vale para questões com alternativas.' })
  if (q.gabarito_confirmado) return { status: 'confirmada' }

  try {
    const r = await executarCascata(event, {
      tarefa: 'gabarito', usuarioId: usuario.sub, maxTokens: 1200, tempoMs: 30000,
      mensagens: montarPedidoGabarito({ enunciado: q.enunciado, alternativas, materia: q.materias?.nome }),
      validar: (json) => validarGabarito(json, alternativas.length),
    })
    const { indice, letra, porque } = r.valor
    const conteudo = {
      ...q.conteudo,
      alternativas: alternativas.map((a, i) => ({ ...a, correta: i === indice })),
      sugestaoIa: { letra, porque, modelo: nomeDoModelo(r.modelo), em: new Date().toISOString() },
    }
    const { error } = await supabase.from('questoes').update({ conteudo, gabarito_confirmado: false, resolver_comparar: false }).eq('id', q.id)
    if (error) throw createError({ statusCode: 500, statusMessage: 'Não deu para guardar a sugestão.' })
    return { status: 'sugerida', letra, porque, modelo: nomeDoModelo(r.modelo), conteudo }
  }
  catch (erro) {
    if (!(erro instanceof FalhaCascata)) throw erro
    return { status: 'falhou', motivo: explicarFalha(erro.tentativas) }
  }
})
