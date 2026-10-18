// POST /api/materiais/:id/gerar
// Gera questões sem IA a partir das páginas conferidas do material.
// Corpo: { gravar: false } devolve só a prévia (quantas por técnica, um exemplo e o motivo quando não sai nada);
//        { gravar: true, tecnicas: ['lacuna', ...] } grava as questões das técnicas escolhidas.
// Roda com a sessão da pessoa (RLS). Nunca registra o texto do material em log.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { TECNICAS, gerarDoMaterial } from '#shared/regras/gerarLocal.js'
import { enunciadoCurto } from '#shared/regras/questoes.js'
import { UUID, emLotes, todasAsLinhas } from '../../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const id = getRouterParam(event, 'id')
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Material inválido.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  const gravar = corpo.gravar === true
  const escolhidas = new Set((Array.isArray(corpo.tecnicas) ? corpo.tecnicas : []).filter((t) => TECNICAS.some((x) => x.id === t)))

  const supabase = await serverSupabaseClient(event)
  const { data: material } = await supabase.from('materiais').select('id, materia_id, status').eq('id', id).maybeSingle()
  if (!material) throw createError({ statusCode: 404, statusMessage: 'Material não encontrado.' })
  const { data: versao } = await supabase.from('material_versoes').select('id').eq('material_id', id).order('numero', { ascending: false }).limit(1).maybeSingle()
  if (!versao) throw createError({ statusCode: 409, statusMessage: 'O material ainda não foi lido.' })

  // Só as páginas conferidas viram questão.
  const { data: paginas, error: erroPaginas } = await supabase.from('material_paginas').select('numero').eq('versao_id', versao.id).not('conferida_em', 'is', null)
  if (erroPaginas) throw createError({ statusCode: 500, statusMessage: 'Não deu para ler o material agora.' })
  const conferidas = new Set(paginas.map((p) => p.numero))

  const [trechos, conceitos, existentes, assuntos] = await Promise.all([
    todasAsLinhas((de, ate) => supabase.from('material_trechos').select('id, ordem, pagina, tipo, texto, usar_em_questoes, assunto_id').eq('versao_id', versao.id).order('ordem').range(de, ate)),
    todasAsLinhas((de, ate) => supabase.from('conceitos').select('id, trecho_id, assunto_id, tipo, termo, definicao, pagina, status').eq('versao_id', versao.id).eq('status', 'aprovado').order('criado_em').range(de, ate)),
    todasAsLinhas((de, ate) => supabase.from('questoes').select('chave').eq('material_id', id).not('chave', 'is', null).range(de, ate)),
    supabase.from('assuntos').select('id').eq('materia_id', material.materia_id).then((r) => r.data ?? []),
  ]).catch(() => {
    throw createError({ statusCode: 500, statusMessage: 'Não deu para ler o material agora.' })
  })

  const resultado = gerarDoMaterial({
    trechos: trechos.filter((t) => conferidas.has(t.pagina)),
    conceitos: conceitos.filter((c) => !c.pagina || conferidas.has(c.pagina)),
    existentes: new Set(existentes.map((q) => q.chave)),
  })

  if (!gravar) {
    return {
      paginasConferidas: conferidas.size,
      tecnicas: TECNICAS.map((t) => {
        const r = resultado[t.id]
        return { id: t.id, nome: t.nome, descricao: t.descricao, quantidade: r.questoes.length, exemplo: r.questoes[0] ? enunciadoCurto(r.questoes[0].enunciado, 160) : '', motivo: r.motivo, repetidas: r.repetidas, descartadas: r.descartadas }
      }),
    }
  }

  // Assunto que não é desta matéria (material movido de matéria) fica vazio.
  const daMateria = new Set(assuntos.map((a) => a.id))
  const linhas = TECNICAS.filter((t) => escolhidas.has(t.id)).flatMap((t) => resultado[t.id].questoes).map((q) => ({
    usuario_id: usuario.sub,
    materia_id: material.materia_id,
    assunto_id: daMateria.has(q.assunto_id) ? q.assunto_id : null,
    material_id: id,
    versao_id: versao.id,
    trecho_id: q.trecho_id,
    conceito_id: q.conceito_id,
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
    }
  }
  catch (erro) {
    console.error('[gerar] material', id, erro?.code ?? 'erro')
    if (erro?.code === 'P0001') throw createError({ statusCode: 409, statusMessage: erro.message })
    throw createError({ statusCode: 500, statusMessage: gravadas ? `Só ${gravadas} questões foram salvas. Tente de novo para gerar o resto.` : 'Não deu para salvar as questões agora. Tente de novo.' })
  }
  return { gravadas }
})
