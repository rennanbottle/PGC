// POST /api/ia/gerar
// Gera questões com IA a partir das páginas conferidas de um material.
// Corpo: { materialId, assuntoIds: [], quantidade: 5 | 10, nivel: 1 | 2 | 3, tipos: [] }.
// Passos: confere permissões e limite do dia (o banco recusa a 11ª geração), escolhe os trechos dos assuntos,
// pede ao primeiro modelo da cascata, confere cada questão, refaz uma vez as reprovadas com o motivo anotado
// e grava as aprovadas como "gerada". Se nenhum modelo responder, a geração fica como "falhou" (não conta no
// limite) e a resposta traz o pedido pronto para colar em outra IA.
// Roda com a sessão da pessoa; só o catálogo e o registro de uso usam a chave secreta, dentro de executarCascata.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { IDS_TIPOS_IA, embaralharAlternativas, escolherTrechos, montarPedidoGerar, montarPedidoRefazer, pedidoParaOutraIA, validarGeradas } from '#shared/regras/ia.js'
import { FalhaCascata, executarCascata, explicarFalha, nomeDoModelo } from '../../utils/ia.js'
import { UUID, todasAsLinhas } from '../../utils/consultas.js'

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const corpo = (await readBody(event).catch(() => null)) ?? {}
  if (!UUID.test(corpo.materialId ?? '')) throw createError({ statusCode: 400, statusMessage: 'Escolha o material.' })
  const quantidade = corpo.quantidade === 5 ? 5 : 10
  const nivel = [1, 2, 3].includes(corpo.nivel) ? corpo.nivel : 2
  const tipos = (Array.isArray(corpo.tipos) ? corpo.tipos : []).filter((t) => IDS_TIPOS_IA.includes(t))
  if (!tipos.length) throw createError({ statusCode: 400, statusMessage: 'Escolha pelo menos um tipo de questão.' })
  const assuntoIds = (Array.isArray(corpo.assuntoIds) ? corpo.assuntoIds : []).filter((x) => UUID.test(x)).slice(0, 20)

  const supabase = await serverSupabaseClient(event)
  const { data: material } = await supabase.from('materiais').select('id, materia_id, titulo, ia_permitida, materias(nome, area)').eq('id', corpo.materialId).maybeSingle()
  if (!material) throw createError({ statusCode: 404, statusMessage: 'Material não encontrado.' })
  if (material.ia_permitida === 'nenhuma') throw createError({ statusCode: 403, statusMessage: 'Este material está marcado para não ir a nenhum serviço externo. Mude em "Quem pode ler o texto" para usar a IA.' })

  const { data: versao } = await supabase.from('material_versoes').select('id').eq('material_id', material.id).order('numero', { ascending: false }).limit(1).maybeSingle()
  if (!versao) throw createError({ statusCode: 409, statusMessage: 'O material ainda não foi lido.' })
  const { data: paginas } = await supabase.from('material_paginas').select('numero').eq('versao_id', versao.id).not('conferida_em', 'is', null)
  const conferidas = new Set((paginas ?? []).map((p) => p.numero))
  if (!conferidas.size) throw createError({ statusCode: 409, statusMessage: 'Confira ao menos uma página do material antes de gerar.' })

  const { data: assuntosMateria } = await supabase.from('assuntos').select('id, nome').eq('materia_id', material.materia_id).is('arquivado_em', null)
  const assuntos = (assuntosMateria ?? []).filter((a) => assuntoIds.includes(a.id))
  const trechos = await todasAsLinhas((de, ate) => supabase.from('material_trechos').select('id, ordem, pagina, tipo, texto, usar_em_questoes, assunto_id').eq('versao_id', versao.id).eq('usar_em_questoes', true).order('ordem').range(de, ate))
  const usaveis = trechos.filter((t) => conferidas.has(t.pagina))
  const doAssunto = assuntos.length ? usaveis.filter((t) => assuntoIds.includes(t.assunto_id)) : []
  const escolha = escolherTrechos(doAssunto.length ? doAssunto : usaveis, 1800)
  if (!escolha.trechos.length) throw createError({ statusCode: 409, statusMessage: 'Não há texto conferido para esses assuntos.' })

  const config = { materialId: material.id, assuntoIds: assuntos.map((a) => a.id), quantidade, nivel, tipos }
  const { data: geracao, error: erroGeracao } = await supabase.from('ia_geracoes').insert({
    materia_id: material.materia_id, material_id: material.id, config, pedidas: quantidade, palavras_enviadas: escolha.palavras, paginas: escolha.paginas,
  }).select('id').single()
  if (erroGeracao) throw createError({ statusCode: erroGeracao.code === 'P0001' ? 429 : 500, statusMessage: erroGeracao.code === 'P0001' ? erroGeracao.message : 'Não deu para começar a geração.' })

  const pedido = montarPedidoGerar({
    materia: material.materias?.nome ?? 'a matéria', area: material.materias?.area, assuntos: assuntos.map((a) => a.nome),
    trechos: escolha.trechos, quantidade, nivel, tipos,
  })
  const permiteTreino = material.ia_permitida === 'todas'
  const contexto = { tipos, nivel, assuntos }
  const inicio = Date.now()

  let primeira
  try {
    primeira = await executarCascata(event, {
      tarefa: 'gerar', permiteTreino, usuarioId: usuario.sub, mensagens: pedido.mensagens,
      validar: (json) => {
        const r = validarGeradas(json, contexto)
        return r.aprovadas.length || r.reprovadas.length ? { ok: true, valor: r } : { ok: false, motivo: 'Nenhuma questão na resposta.' }
      },
    })
  }
  catch (erro) {
    if (!(erro instanceof FalhaCascata)) throw erro
    const motivo = explicarFalha(erro.tentativas)
    await supabase.from('ia_geracoes').update({ status: 'falhou', motivo_falha: motivo.slice(0, 400), concluido_em: new Date().toISOString() }).eq('id', geracao.id)
    return { status: 'falhou', geracaoId: geracao.id, motivo, pedido: pedidoParaOutraIA(pedido.mensagens), materialSoSemTreino: !permiteTreino }
  }

  let aprovadas = primeira.valor.aprovadas.slice(0, quantidade)
  let reprovadas = primeira.valor.reprovadas
  let refeitas = 0
  // Reprovadas: uma nova chance, com o motivo anotado. Reprovou de novo, é descartada e registrada.
  if (reprovadas.length && aprovadas.length < quantidade) {
    try {
      const segunda = await executarCascata(event, {
        tarefa: 'refazer', permiteTreino, usuarioId: usuario.sub, maxTentativas: 1,
        mensagens: montarPedidoRefazer(pedido.mensagens, reprovadas.slice(0, quantidade - aprovadas.length)),
        validar: (json) => ({ ok: true, valor: validarGeradas(json, contexto) }),
      })
      const novas = segunda.valor.aprovadas.slice(0, quantidade - aprovadas.length)
      refeitas = novas.length
      aprovadas = [...aprovadas, ...novas.map((q) => ({ ...q, refeita: true }))]
      reprovadas = segunda.valor.reprovadas.length ? segunda.valor.reprovadas : reprovadas.slice(novas.length)
    }
    catch (erro) {
      if (!(erro instanceof FalhaCascata)) throw erro
    }
  }

  const primeiroAssunto = assuntos[0]?.id ?? null
  const linhas = aprovadas.map((q) => ({
    materia_id: material.materia_id,
    assunto_id: q.assuntoId ?? (assuntos.length === 1 ? primeiroAssunto : null),
    material_id: material.id,
    versao_id: versao.id,
    geracao_id: geracao.id,
    modelo_id: primeira.modelo.id,
    tipo: q.tipo,
    nivel: q.nivel,
    bloom: q.bloom,
    enunciado: q.enunciado,
    conteudo: embaralharAlternativas(q.conteudo),
    explicacao: q.explicacao,
    origem: 'gerada',
    status: 'ativa',
    qualidade_aprovada: true,
    avisos_qualidade: q.avisos ?? [],
  }))
  if (linhas.length) {
    const { error } = await supabase.from('questoes').insert(linhas)
    if (error) {
      await supabase.from('ia_geracoes').update({ status: 'falhou', motivo_falha: 'Não deu para salvar as questões.', concluido_em: new Date().toISOString() }).eq('id', geracao.id)
      throw createError({ statusCode: error.code === 'P0001' ? 409 : 500, statusMessage: error.code === 'P0001' ? error.message : 'Não deu para salvar as questões. Tente de novo.' })
    }
  }
  const descartadas = reprovadas.slice(0, Math.max(0, quantidade - linhas.length)).map((r) => ({
    enunciado: String(r.bruta?.enunciado ?? '').slice(0, 300),
    tipo: String(r.bruta?.tipo ?? '').slice(0, 40),
    motivo: r.motivos.join(' ').slice(0, 300),
  }))
  await supabase.from('ia_geracoes').update({
    status: linhas.length ? 'concluida' : 'falhou',
    modelo_id: primeira.modelo.id,
    modelo_nome: nomeDoModelo(primeira.modelo),
    salvas: linhas.length,
    refeitas,
    descartadas,
    latencia_ms: Date.now() - inicio,
    motivo_falha: linhas.length ? null : 'Nenhuma questão passou na conferência.',
    concluido_em: new Date().toISOString(),
  }).eq('id', geracao.id)
  return { status: linhas.length ? 'concluida' : 'falhou', geracaoId: geracao.id, salvas: linhas.length, motivo: linhas.length ? undefined : 'Nenhuma questão passou na conferência. Tente de novo ou mude os tipos.', pedido: linhas.length ? undefined : pedidoParaOutraIA(pedido.mensagens) }
})
