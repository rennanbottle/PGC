// POST /api/ia/colar
// Resposta trazida de outra IA (quando nenhum serviço do PGC respondeu). Corpo: { geracaoId, resposta }.
// A resposta passa pela mesma conferência; as aprovadas entram como "gerada", com o modelo "outra IA".
// Não conta no limite do dia (a geração já estava marcada como "falhou"). No misto, as questões sem IA já estão salvas;
// a resposta colada completa só o que faltava para a IA.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { ESTILO, somaNiveis } from '#shared/regras/gerar.js'
import { IDS_TIPOS_IA, conferirRespostaColada, embaralharAlternativas } from '#shared/regras/ia.js'
import { UUID } from '../../utils/consultas.js'
import { descartadasParaGravar, linhasDaIa } from '../../utils/gerar.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (!UUID.test(corpo.geracaoId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Geração inválida.' })
  const resposta = String(corpo.resposta ?? '')
  if (resposta.length > 120000) throw createError({ statusCode: 413, statusMessage: 'A resposta colada é grande demais.' })

  const supabase = await serverSupabaseClient(event)
  const { data: geracao } = await supabase.from('ia_geracoes').select('id, materia_id, material_id, status, config').eq('id', corpo.geracaoId).maybeSingle()
  if (!geracao) throw createError({ statusCode: 404, statusMessage: 'Geração não encontrada.' })
  if (geracao.status !== 'falhou') throw createError({ statusCode: 409, statusMessage: 'Esta geração já foi concluída.' })

  const config = geracao.config ?? {}
  const { data: assuntosMateria } = await supabase.from('assuntos').select('id, nome').eq('materia_id', geracao.materia_id).is('arquivado_em', null)
  const marcados = (assuntosMateria ?? []).filter((a) => (config.assuntoIds ?? []).includes(a.id))
  // Gerações da página nova guardam a lista de materiais (M1, M2...) e os níveis que faltavam para a IA.
  const idsMateriais = Array.isArray(config.materiais) ? config.materiais.map((m) => m.id) : (geracao.material_id ? [geracao.material_id] : [])
  const materiais = []
  for (const [i, mid] of idsMateriais.entries()) {
    const { data: versao } = await supabase.from('material_versoes').select('id').eq('material_id', mid).order('numero', { ascending: false }).limit(1).maybeSingle()
    if (versao) materiais.push({ id: mid, versaoId: versao.id, rotulo: `M${i + 1}` })
  }
  const niveis = config.niveisIa ?? config.niveis ?? { [config.nivel ?? 2]: config.quantidade ?? 10 }
  const quantidade = somaNiveis(niveis) || 10
  const r = conferirRespostaColada(resposta, {
    tipos: (config.tipos ?? []).filter((t) => IDS_TIPOS_IA.includes(t)),
    niveis,
    assuntos: marcados.length ? marcados : assuntosMateria ?? [],
    alternativas: ESTILO[config.estilo]?.alternativas ?? null,
  }, quantidade)
  if (!r.ok) return { status: 'invalida', motivo: r.motivo, linha: r.linha ?? null, problemas: r.problemas }
  const aprovadas = r.aprovadas

  const conteudo = { materia: { id: geracao.materia_id }, assuntos: marcados, materiais: config.fonte === 'assunto' ? [] : materiais }
  const linhas = linhasDaIa(conteudo, aprovadas.map((q) => ({ ...q, conteudo: embaralharAlternativas(q.conteudo) })), { geracaoId: geracao.id })
  const { error } = await supabase.from('questoes').insert(linhas)
  if (error) throw createError({ statusCode: error.code === 'P0001' ? 409 : 500, statusMessage: error.code === 'P0001' ? error.message : 'Não deu para salvar as questões.' })
  const { count: jaSalvas } = await supabase.from('questoes').select('id', { count: 'exact', head: true }).eq('geracao_id', geracao.id)
  await supabase.from('ia_geracoes').update({
    status: 'concluida',
    modelo_nome: 'Outra IA, resposta colada',
    salvas: jaSalvas ?? linhas.length,
    descartadas: descartadasParaGravar(r.reprovadas, quantidade - linhas.length),
    motivo_falha: null,
    concluido_em: new Date().toISOString(),
  }).eq('id', geracao.id)
  return { status: 'concluida', geracaoId: geracao.id, salvas: linhas.length }
})
