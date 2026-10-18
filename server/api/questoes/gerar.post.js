// POST /api/questoes/gerar
// A página "Gerar questões" inteira passa por aqui. Corpo: a configuração da página (lerConfigGerar) e "acao":
//   previa  devolve o que vai acontecer: técnicas sem IA com quantas saem, o plano do misto (quantas sem IA e
//           quantas a IA escreve), o tamanho do texto enviado, o pedido completo para outra IA (jeito "externa",
//           em pedido.texto) e quem lê o texto.
//   gerar   grava. Sem IA: até "quantidade" das técnicas escolhidas (devolve os ids). IA do PGC e misto: chama a
//           cascata, confere, refaz uma vez as reprovadas e grava as aprovadas. Se nenhum serviço responder,
//           devolve o pedido completo para outra IA.
//   colar   jeito "outra IA": confere a resposta colada e grava as aprovadas. Não conta no limite do dia.
//           Resposta recusada: { status: 'invalida', motivo, linha, problemas: [{ numero, tipo, motivos }] }.
// O trabalho fica em server/utils/gerarIa.js (a revisão também usa para completar com IA).
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { lerConfigGerar } from '#shared/regras/gerar.js'
import { executarGeracao } from '../../utils/gerarIa.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const acao = ['previa', 'gerar', 'colar'].includes(corpo.acao) ? corpo.acao : 'previa'
  const lido = lerConfigGerar(corpo)
  if (lido.erro) throw createError({ statusCode: 400, statusMessage: lido.erro })
  const config = lido.config
  if (acao === 'colar' && config.modo !== 'externa') throw createError({ statusCode: 400, statusMessage: 'Colar a resposta só vale no jeito "Outra IA".' })
  if (acao === 'gerar' && config.modo === 'externa') throw createError({ statusCode: 400, statusMessage: 'No jeito "Outra IA", copie o pedido e cole a resposta.' })

  const supabase = await serverSupabaseClient(event)
  try {
    return await executarGeracao(event, { supabase, usuario, config, acao, resposta: corpo.resposta })
  }
  catch (e) {
    if (e?.statusCode) throw e
    // Erro inesperado: o terminal mostra o motivo (sem texto do material) e a tela recebe uma frase com o código.
    console.error('[gerar] erro inesperado', acao, config.modo, e?.code ?? '', e?.message ?? e)
    throw createError({ statusCode: 500, statusMessage: `Algo deu errado no servidor (${e?.code || e?.name || 'erro interno'}). Tente de novo. Se repetir, mande a linha "[gerar]" do terminal.` })
  }
})
