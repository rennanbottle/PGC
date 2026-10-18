// Completar um bloco de Prática quando o banco não tem questões novas bastantes: primeiro com questões do material
// (sem IA) e, se a pessoa marcou, com uma geração de IA (1 das 30 operações do dia). Quem chama é montarConjunto.js.
import { IDS_TIPOS_IA } from '#shared/regras/ia.js'
import { lerConfigGerar } from '#shared/regras/gerar.js'
import { carregarConteudo, gravarLocais, questoesLocais } from './gerar.js'
import { executarGeracao } from './gerarIa.js'

export async function completarComMaterial(supabase, usuario, assuntoId, falta, config) {
  const { data: assunto } = await supabase.from('assuntos').select('materia_id').eq('id', assuntoId).maybeSingle()
  if (!assunto) return 0
  const { data: materiais } = await supabase.from('materiais').select('id').eq('materia_id', assunto.materia_id).is('arquivado_em', null).in('status', ['aguardando_conferencia', 'pronto']).limit(5)
  if (!materiais?.length) return 0
  let conteudo
  try {
    conteudo = await carregarConteudo(supabase, { materiaId: assunto.materia_id, fonte: 'materiais', materiais: materiais.map((m) => ({ id: m.id, de: 1, ate: 5000 })), assuntoIds: [assuntoId] }, { conceitos: true })
  }
  catch {
    return 0
  }
  const locais = Object.values(await questoesLocais(supabase, conteudo)).flatMap((r) => r.questoes)
    .filter((q) => q.assunto_id === assuntoId && config.tipos.includes(q.tipo))
  if (!locais.length) return 0
  return gravarLocais(supabase, usuario.sub, conteudo, locais.slice(0, falta))
}

export async function completarComIa(event, supabase, usuario, assuntoId, falta, config) {
  const tipos = config.tipos.filter((t) => IDS_TIPOS_IA.includes(t))
  if (!tipos.length) return { salvas: 0, aviso: 'Os tipos escolhidos não são escritos pela IA.' }
  const { data: assunto } = await supabase.from('assuntos').select('materia_id').eq('id', assuntoId).maybeSingle()
  if (!assunto) return { salvas: 0 }
  const { data: materiais } = await supabase.from('materiais').select('id').eq('materia_id', assunto.materia_id).is('arquivado_em', null).in('status', ['aguardando_conferencia', 'pronto']).limit(5)
  const nivel = config.dificuldade.modo === 'fixa' ? Math.min(3, config.dificuldade.nivel) : 2
  const tentar = async (fonte) => {
    const lido = lerConfigGerar({
      modo: 'ia', materiaId: assunto.materia_id, fonte, materiais: (materiais ?? []).map((m) => ({ id: m.id, de: 1, ate: 5000 })),
      assuntoIds: [assuntoId], quantidade: Math.min(10, falta), dificuldade: { modo: 'uma', nivel }, estilo: 'livre', tipos,
    })
    if (lido.erro) return { salvas: 0, aviso: lido.erro }
    return executarGeracao(event, { supabase, usuario, config: lido.config, acao: 'gerar' })
  }
  try {
    let r = materiais?.length ? await tentar('materiais').catch(() => null) : null
    if (!r || r.status !== 'concluida') r = await tentar('assunto')
    if (r.status === 'concluida') return { salvas: r.salvas, geracaoId: r.geracaoId ?? null, aviso: materiais?.length ? null : 'As questões da IA saíram sem material: confira o gabarito delas no banco para entrarem nas revisões.' }
    return { salvas: 0, aviso: r.motivo ?? 'A IA não respondeu agora.' }
  }
  catch (e) {
    return { salvas: 0, aviso: e?.statusMessage ?? 'A IA não respondeu agora.' }
  }
}
