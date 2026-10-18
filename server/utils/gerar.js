// Leitura do conteúdo para a página "Gerar questões" (só no servidor, com a sessão da pessoa).
// Junta a matéria, os assuntos e, de cada material escolhido, a versão mais nova, as páginas conferidas dentro do
// intervalo pedido, os trechos e os conceitos aprovados. Nada aqui grava texto de material em log.
import { gerarDoMaterial, TECNICAS } from '#shared/regras/gerarLocal.js'
import { escolherTrechos } from '#shared/regras/ia.js'
import { enunciadoCurto } from '#shared/regras/questoes.js'
import { emLotes, todasAsLinhas } from './consultas.js'

const erro = (statusCode, statusMessage) => createError({ statusCode, statusMessage })

export async function carregarConteudo(supabase, config, { conceitos: comConceitos = false } = {}) {
  const { data: materia } = await supabase.from('materias').select('id, nome, area').eq('id', config.materiaId).maybeSingle()
  if (!materia) throw erro(404, 'Matéria não encontrada.')
  const { data: assuntosMateria } = await supabase.from('assuntos').select('id, nome').eq('materia_id', materia.id).is('arquivado_em', null)
  const marcados = new Set(config.assuntoIds)
  const assuntos = (assuntosMateria ?? []).filter((a) => marcados.has(a.id))
  // Sem texto e sem assunto marcado, vale a matéria toda. Assunto marcado que não é desta matéria é erro.
  if (config.assuntoIds.length && !assuntos.length) throw erro(400, 'Os assuntos marcados não são desta matéria. Recarregue a página.')

  const materiais = []
  for (const [i, pedido] of config.materiais.entries()) {
    const { data: material } = await supabase.from('materiais').select('id, materia_id, titulo, ia_permitida').eq('id', pedido.id).maybeSingle()
    if (!material) throw erro(404, 'Um dos materiais não foi encontrado.')
    if (material.materia_id !== materia.id) throw erro(400, `"${material.titulo}" é de outra matéria.`)
    const { data: versao } = await supabase.from('material_versoes').select('id').eq('material_id', material.id).order('numero', { ascending: false }).limit(1).maybeSingle()
    if (!versao) throw erro(409, `"${material.titulo}" ainda não foi lido.`)
    const { data: paginas } = await supabase.from('material_paginas').select('numero').eq('versao_id', versao.id).not('conferida_em', 'is', null)
    const conferidas = new Set((paginas ?? []).map((p) => p.numero).filter((n) => n >= pedido.de && n <= pedido.ate))
    const trechos = (await todasAsLinhas((de, ate) => supabase.from('material_trechos').select('id, ordem, pagina, tipo, texto, usar_em_questoes, assunto_id').eq('versao_id', versao.id).gte('pagina', pedido.de).lte('pagina', pedido.ate).order('ordem').range(de, ate)))
      .filter((t) => conferidas.has(t.pagina))
    const conceitos = comConceitos
      ? (await todasAsLinhas((de, ate) => supabase.from('conceitos').select('id, trecho_id, assunto_id, tipo, termo, definicao, pagina, status').eq('versao_id', versao.id).eq('status', 'aprovado').order('criado_em').range(de, ate)))
          .filter((c) => !c.pagina || conferidas.has(c.pagina))
      : []
    materiais.push({ ...material, versaoId: versao.id, rotulo: `M${i + 1}`, conferidas: conferidas.size, trechos, conceitos })
  }
  if (config.fonte === 'materiais' && !materiais.some((m) => m.conferidas)) throw erro(409, 'Não há página conferida nesse intervalo. Confira as páginas do material ou mude o intervalo.')
  return {
    materia,
    assuntos,
    assuntosMateria: assuntosMateria ?? [],
    materiais,
    // A IA só lê se todos os materiais deixam; treino só se todos deixam.
    iaBloqueada: materiais.filter((m) => m.ia_permitida === 'nenhuma').map((m) => m.titulo),
    permiteTreino: materiais.length > 0 && materiais.every((m) => m.ia_permitida === 'todas'),
  }
}

// Com assuntos marcados, fica só o que está ligado a eles (se nada estiver ligado, vale o material todo).
function doAssunto(lista, ids) {
  if (!ids.size) return { lista, semLigacao: false }
  const f = lista.filter((x) => ids.has(x.assunto_id))
  return f.length ? { lista: f, semLigacao: false } : { lista, semLigacao: true }
}

// Trechos que vão para a IA: os dos assuntos marcados, na ordem de cada material, até ~1.800 palavras no total.
export function trechosParaIa(conteudo) {
  const ids = new Set(conteudo.assuntos.map((a) => a.id))
  const varios = conteudo.materiais.length > 1
  const todos = conteudo.materiais.flatMap((m, i) => m.trechos
    .filter((t) => t.usar_em_questoes !== false)
    .map((t) => ({ ...t, ordem: i * 1e7 + t.ordem, rotulo: varios ? m.rotulo : undefined })))
  const { lista, semLigacao } = doAssunto(todos, ids)
  const escolha = escolherTrechos(lista, 1800)
  if (varios) {
    const porMaterial = conteudo.materiais.map((m) => {
      const pags = [...new Set(escolha.trechos.filter((t) => t.rotulo === m.rotulo).map((t) => t.pagina))].sort((a, b) => a - b)
      return pags.length ? `${m.rotulo} ${pags.length === 1 ? `p. ${pags[0]}` : `p. ${pags[0]} a ${pags.at(-1)}`}` : null
    }).filter(Boolean)
    escolha.paginas = porMaterial.join(', ').slice(0, 80)
  }
  return { ...escolha, semLigacao }
}

// Questões sem IA de todos os materiais, por técnica, já com o material e a versão de origem.
export async function questoesLocais(supabase, conteudo) {
  const ids = new Set(conteudo.assuntos.map((a) => a.id))
  const porTecnica = Object.fromEntries(TECNICAS.map((t) => [t.id, { questoes: [], motivo: '', repetidas: 0, descartadas: 0 }]))
  for (const m of conteudo.materiais) {
    const existentes = await todasAsLinhas((de, ate) => supabase.from('questoes').select('chave').eq('material_id', m.id).not('chave', 'is', null).range(de, ate))
    const r = gerarDoMaterial({
      trechos: doAssunto(m.trechos, ids).lista,
      conceitos: doAssunto(m.conceitos, ids).lista,
      existentes: new Set(existentes.map((q) => q.chave)),
    })
    for (const t of TECNICAS) {
      const alvo = porTecnica[t.id]
      alvo.questoes.push(...r[t.id].questoes.map((q) => ({ ...q, tecnica: t.id, material_id: m.id, versao_id: m.versaoId })))
      alvo.repetidas += r[t.id].repetidas ?? 0
      alvo.descartadas += r[t.id].descartadas ?? 0
      if (!alvo.motivo) alvo.motivo = r[t.id].motivo ?? ''
    }
  }
  return porTecnica
}

export function resumoTecnicas(porTecnica) {
  return TECNICAS.map((t) => {
    const r = porTecnica[t.id]
    return { id: t.id, nome: t.nome, descricao: t.descricao, quantidade: r.questoes.length, exemplo: r.questoes[0] ? enunciadoCurto(r.questoes[0].enunciado, 160) : '', motivo: r.questoes.length ? '' : r.motivo, repetidas: r.repetidas }
  })
}

// Grava questões sem IA (origem "material"); a chave evita repetir a mesma questão de outra geração.
// "ids", se vier uma lista, recebe os ids das questões gravadas (para a tela de conferência).
export async function gravarLocais(supabase, usuarioId, conteudo, questoes, geracaoId = null, ids = null) {
  const daMateria = new Set(conteudo.assuntosMateria.map((a) => a.id))
  const linhas = questoes.map((q) => ({
    usuario_id: usuarioId,
    materia_id: conteudo.materia.id,
    assunto_id: daMateria.has(q.assunto_id) ? q.assunto_id : null,
    material_id: q.material_id,
    versao_id: q.versao_id,
    trecho_id: q.trecho_id,
    conceito_id: q.conceito_id,
    geracao_id: geracaoId,
    tipo: q.tipo,
    nivel: q.nivel,
    bloom: q.bloom,
    enunciado: q.enunciado.slice(0, 5000),
    conteudo: q.conteudo,
    explicacao: q.explicacao ? q.explicacao.slice(0, 3000) : null,
    origem: 'material',
    status: 'ativa',
    chave: q.chave,
  }))
  let gravadas = 0
  try {
    for (const lote of emLotes(linhas, 300)) {
      const { data, error } = await supabase.from('questoes').upsert(lote, { onConflict: 'usuario_id,chave', ignoreDuplicates: true }).select('id')
      if (error) throw error
      gravadas += data.length
      if (Array.isArray(ids)) ids.push(...data.map((q) => q.id))
    }
  }
  catch (e) {
    console.error('[gerar] locais', e?.code ?? 'erro')
    if (e?.code === 'P0001') throw erro(409, e.message)
    throw erro(500, gravadas ? `Só ${gravadas} questões foram salvas. Tente de novo para gerar o resto.` : 'Não deu para salvar as questões agora. Tente de novo.')
  }
  return gravadas
}

// Linhas das questões aprovadas da IA. Entram direto no Estudar (pedido do R, 11/10): não há passo de "manter"
// nem de confirmar o gabarito, e a resposta só aparece quando a pessoa responde. Questão com problema sai dos
// estudos pela própria correção ("Questão com problema").
export function linhasDaIa(conteudo, aprovadas, { geracaoId, modeloId = null }) {
  const unicoAssunto = conteudo.assuntos.length === 1 ? conteudo.assuntos[0].id : null
  return aprovadas.map((q) => {
    const m = conteudo.materiais.find((x) => x.rotulo === q.material) ?? conteudo.materiais[0]
    return {
      materia_id: conteudo.materia.id,
      assunto_id: q.assuntoId ?? unicoAssunto,
      material_id: m?.id ?? null,
      versao_id: m?.versaoId ?? null,
      geracao_id: geracaoId,
      modelo_id: modeloId,
      tipo: q.tipo,
      nivel: q.nivel,
      bloom: q.bloom,
      enunciado: q.enunciado,
      conteudo: q.conteudo,
      explicacao: q.explicacao,
      origem: 'gerada',
      status: 'ativa',
      gabarito_confirmado: true,
      qualidade_aprovada: true,
      avisos_qualidade: q.avisos ?? [],
    }
  })
}

export const descartadasParaGravar = (reprovadas, n) => reprovadas.slice(0, Math.max(0, n)).map((r) => ({
  enunciado: String(r.bruta?.enunciado ?? '').slice(0, 300),
  tipo: String(r.bruta?.tipo ?? '').slice(0, 40),
  motivo: r.motivos.join(' ').slice(0, 300),
}))
