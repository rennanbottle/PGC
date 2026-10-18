// POST /api/revisoes
// Começa uma execução de estudo em blocos. Corpo:
//   { blocos, nome?, receita?, conjuntoId? }  blocos de Revisão e Prática (de uma receita, do construtor ou de
//                                              um conjunto salvo; com conjuntoId e sem blocos, usa os do conjunto)
//   { refazer: <id> }                          outra execução só com as erradas e parciais daquela
// Escolhe as questões de cada bloco sem repetir entre blocos, completa Práticas com material ou IA se a pessoa
// pediu, congela cada questão no item e devolve o id para abrir em modo foco.
import { RECEITA } from '#shared/regras/conjuntos.js'
import { lerConjunto, montarConjunto, tituloDoConjunto } from '../../utils/montarConjunto.js'
import { carregarRevisao, criarExecucao, criarRevisao, pessoa, prepararBloco } from '../../utils/revisoes.js'
import { UUID } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const { usuario, supabase, admin } = await pessoa(event)
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (UUID.test(corpo.refazer ?? '')) {
    // Também vale para uma prova entregue: as erradas e as em branco viram um estudo com correção a cada questão.
    const { revisao, itens } = await carregarRevisao(admin, usuario.sub, corpo.refazer, { tipo: null })
    const prova = revisao.tipo === 'prova'
    if (prova && revisao.status !== 'concluida') throw createError({ statusCode: 409, statusMessage: 'Entregue a prova antes de treinar as erradas.' })
    const erradas = itens.filter((i) => (prova ? i.resultado !== 'correta' : i.resultado && i.resultado !== 'correta') && i.questao_id)
    if (!erradas.length) throw createError({ statusCode: 409, statusMessage: 'Esta execução não tem erradas para refazer.' })
    const base = revisao.blocos?.[0]?.config ?? revisao.config
    const config = { ...base, modelo: 'personalizada', quantidade: Math.min(60, erradas.length), correcao: 'cada', ...(prova ? { dicas: 3, nivelNaQuestao: 'mostrar', formulario: true, cronometro: { modo: 'sem', minutos: 25, segundos: 90 } } : {}) }
    const id = await criarRevisao({ admin, supabase, usuario, config, titulo: `Refazer as erradas, ${revisao.titulo}`.slice(0, 120), itens: erradas.slice(0, 60).map((i) => ({ id: i.questao_id })) })
    return { id, avisos: [] }
  }

  let nome = String(corpo.nome ?? '').trim()
  let lista = corpo.blocos
  let conjuntoId = null
  if (UUID.test(corpo.conjuntoId ?? '')) {
    const { data: conjunto } = await supabase.from('conjuntos').select('id, nome, blocos').eq('id', corpo.conjuntoId).maybeSingle()
    if (!conjunto) throw createError({ statusCode: 404, statusMessage: 'Conjunto não encontrado.' })
    conjuntoId = conjunto.id
    nome = nome || conjunto.nome
    if (!Array.isArray(lista)) lista = conjunto.blocos
  }
  const receita = RECEITA[corpo.receita] ? corpo.receita : null
  nome = nome || (receita ? RECEITA[receita].nome : 'Estudo')
  const { blocos, estudo } = await lerConjunto(supabase, lista)

  const { count: abertas } = await admin.from('revisoes').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.sub).in('status', ['em_andamento', 'pausada'])
  if ((abertas ?? 0) >= 5) throw createError({ statusCode: 409, statusMessage: 'Você tem 5 estudos abertos. Termine ou encerre um antes de começar outro.' })
  const inicioDoDia = new Date(Math.floor((Date.now() - 3 * 3600 * 1000) / 86400000) * 86400000 + 3 * 3600 * 1000).toISOString()
  const { count: hoje } = await admin.from('revisoes').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.sub).gte('criado_em', inicioDoDia)
  if ((hoje ?? 0) >= 40) throw createError({ statusCode: 429, statusMessage: 'Já são 40 estudos hoje. Amanhã libera de novo.' })

  const montado = await montarConjunto(event, { supabase, usuario, blocos })
  const id = await criarExecucao({
    admin, supabase, usuario, titulo: await tituloDoConjunto(supabase, nome, blocos), modelo: receita ?? 'personalizada', conjuntoId,
    blocos: montado.blocos, geracaoId: montado.geracaoId, agendada: receita === 'revisao_do_dia' && (estudo.vencidas ?? 0) > 0,
  })
  if (montado.blocos[0].adiado) {
    const { revisao, itens } = await carregarRevisao(admin, usuario.sub, id)
    await prepararBloco({ admin, supabase, usuario, revisao, itens, bloco: 0 })
  }
  return { id, avisos: montado.avisos }
})
