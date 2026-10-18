// Geração de questões (página "Gerar questões" e completar uma revisão com IA). Recebe a configuração já conferida
// por lerConfigGerar e faz a prévia, a gravação sem IA, a cascata de IA (com refazer) ou confere a resposta colada.
// Roda com a sessão da pessoa (RLS). Só o catálogo e o registro de uso usam a chave secreta (executarCascata).
import { ESTILO, LOTE_IA, TIPOS_SO_MATERIAL, dividirNiveis, escolherLocais, escolherMisto, somaNiveis } from '#shared/regras/gerar.js'
import { IDS_TIPOS_IA, conferirRespostaColada, embaralharAlternativas, montarPedidoGerar, montarPedidoOutraIa, montarPedidoRefazer, validarGeradas } from '#shared/regras/ia.js'
import { FalhaCascata, executarCascata, explicarFalha, nomeDoModelo } from './ia.js'
import { carregarConteudo, descartadasParaGravar, gravarLocais, linhasDaIa, questoesLocais, resumoTecnicas, trechosParaIa } from './gerar.js'

const niveisDoContexto = (contexto) => contexto.niveis

function montarPedido(conteudo, config, niveis) {
  const semMaterial = config.fonte === 'assunto'
  const escolha = semMaterial ? { trechos: [], palavras: 0, paginas: '', semLigacao: false } : trechosParaIa(conteudo)
  if (!semMaterial && !escolha.trechos.length) throw createError({ statusCode: 409, statusMessage: 'Não há texto conferido para esses assuntos nesse intervalo de páginas.' })
  const tipos = config.tipos.filter((t) => IDS_TIPOS_IA.includes(t))
  const pedido = montarPedidoGerar({
    materia: conteudo.materia.nome,
    area: conteudo.materia.area,
    assuntos: conteudo.assuntos.map((a) => a.nome),
    trechos: escolha.trechos,
    quantidade: somaNiveis(niveis),
    niveis,
    tipos,
    estilo: config.estilo,
    instrucoes: config.instrucoes,
    semMaterial,
  })
  const contexto = { tipos, niveis, assuntos: conteudo.assuntos.length ? conteudo.assuntos : conteudo.assuntosMateria, alternativas: ESTILO[config.estilo]?.alternativas ?? null, semente: config.semente }
  // O mesmo pedido, completo e com exemplos, para a pessoa colar em outra IA.
  const textoOutraIa = () => montarPedidoOutraIa({
    materia: conteudo.materia.nome,
    area: conteudo.materia.area,
    assuntos: conteudo.assuntos.map((a) => a.nome),
    trechos: escolha.trechos,
    textos: conteudo.materiais.map((m) => (conteudo.materiais.length > 1 ? `${m.rotulo}: ${m.titulo}` : m.titulo)),
    quantidade: somaNiveis(niveis),
    niveis,
    tipos,
    estilo: config.estilo,
    instrucoes: config.instrucoes,
    semMaterial,
    semente: config.semente,
  })
  return { pedido, escolha, contexto, textoOutraIa }
}

// acao: 'previa' | 'gerar' | 'colar'. Devolve o mesmo objeto que a rota responde.
export async function executarGeracao(event, { supabase, usuario, config, acao = 'gerar', resposta = '' }) {
  const usaLocal = config.modo === 'local' || config.modo === 'misto'
  const conteudo = await carregarConteudo(supabase, config, { conceitos: usaLocal })
  const locais = usaLocal ? await questoesLocais(supabase, conteudo) : null

  // Misto: o que dá sem IA entra primeiro; a IA escreve o que falta de cada nível.
  let misto = null
  if (config.modo === 'misto') misto = escolherMisto(Object.values(locais).flatMap((r) => r.questoes), config.niveis, [...config.tipos, ...TIPOS_SO_MATERIAL])
  const niveisIa = misto ? misto.faltam : config.niveis
  const precisaIa = config.modo !== 'local' && somaNiveis(niveisIa) > 0

  // ---------- Prévia ----------
  if (acao === 'previa') {
    let pedido = null
    if (precisaIa) {
      const p = montarPedido(conteudo, config, niveisIa)
      pedido = { palavras: p.escolha.palavras, paginas: p.escolha.paginas, semLigacao: p.escolha.semLigacao, ...(config.modo === 'externa' ? { texto: p.textoOutraIa() } : {}) }
    }
    return {
      tecnicas: config.modo === 'local' ? resumoTecnicas(locais) : null,
      plano: { semIa: misto ? misto.escolhidas.length : 0, ia: precisaIa ? somaNiveis(niveisIa) : 0, niveisIa },
      pedido,
      paginasConferidas: conteudo.materiais.reduce((s, m) => s + m.conferidas, 0),
      iaBloqueada: conteudo.iaBloqueada,
      permiteTreino: conteudo.permiteTreino,
    }
  }

  // ---------- Sem IA ----------
  if (config.modo === 'local') {
    const escolhidas = escolherLocais(locais, config.tecnicas, config.quantidade)
    if (!escolhidas.length) throw createError({ statusCode: 400, statusMessage: 'Marque pelo menos um jeito que tire questões do texto.' })
    const ids = []
    const salvas = await gravarLocais(supabase, usuario.sub, conteudo, escolhidas, null, ids)
    return { status: 'concluida', salvas, semIa: true, ids }
  }

  // ---------- Outra IA: conferir a resposta colada ----------
  if (acao === 'colar') {
    const colada = String(resposta ?? '')
    if (colada.length > 120000) throw createError({ statusCode: 413, statusMessage: 'A resposta colada é grande demais.' })
    const { contexto } = montarPedido(conteudo, config, niveisIa)
    const r = conferirRespostaColada(colada, contexto, config.quantidade)
    if (!r.ok) return { status: 'invalida', motivo: r.motivo, linha: r.linha ?? null, problemas: r.problemas }
    const aprovadas = r.aprovadas
    const { data: geracao, error: erroGeracao } = await supabase.from('ia_geracoes').insert({
      materia_id: conteudo.materia.id, material_id: conteudo.materiais[0]?.id ?? null, modo: 'externa', config: { ...config, niveisIa }, pedidas: config.quantidade,
    }).select('id').single()
    if (erroGeracao) throw createError({ statusCode: 500, statusMessage: 'Não deu para salvar as questões.' })
    const linhas = linhasDaIa(conteudo, aprovadas.map((q) => ({ ...q, conteudo: embaralharAlternativas(q.conteudo) })), { geracaoId: geracao.id })
    const { error } = await supabase.from('questoes').insert(linhas)
    if (error) {
      await supabase.from('ia_geracoes').update({ status: 'falhou', motivo_falha: 'Não deu para salvar as questões.', concluido_em: new Date().toISOString() }).eq('id', geracao.id)
      throw createError({ statusCode: error.code === 'P0001' ? 409 : 500, statusMessage: error.code === 'P0001' ? error.message : 'Não deu para salvar as questões.' })
    }
    await supabase.from('ia_geracoes').update({
      status: 'concluida', modelo_nome: 'Outra IA, resposta colada', salvas: linhas.length,
      descartadas: descartadasParaGravar(r.reprovadas, config.quantidade - linhas.length), concluido_em: new Date().toISOString(),
    }).eq('id', geracao.id)
    return { status: 'concluida', geracaoId: geracao.id, salvas: linhas.length }
  }

  // ---------- IA do PGC e misto ----------
  if (conteudo.iaBloqueada.length) throw createError({ statusCode: 403, statusMessage: `"${conteudo.iaBloqueada[0]}" está marcado para não ir a nenhum serviço externo. Mude em "Quem pode ler o texto" ou use o jeito sem IA.` })
  if (!precisaIa) {
    const ids = []
    const salvas = await gravarLocais(supabase, usuario.sub, conteudo, misto.escolhidas, null, ids)
    return { status: 'concluida', salvas, semIa: true, ids }
  }
  const quantidadeIa = somaNiveis(niveisIa)
  const { pedido, escolha, contexto, textoOutraIa } = montarPedido(conteudo, config, niveisIa)
  const { data: geracao, error: erroGeracao } = await supabase.from('ia_geracoes').insert({
    materia_id: conteudo.materia.id,
    material_id: conteudo.materiais[0]?.id ?? null,
    modo: config.modo,
    config: { ...config, niveisIa },
    pedidas: config.quantidade,
    palavras_enviadas: escolha.palavras || null,
    paginas: escolha.paginas || null,
  }).select('id').single()
  if (erroGeracao) throw createError({ statusCode: erroGeracao.code === 'P0001' ? 429 : 500, statusMessage: erroGeracao.code === 'P0001' ? erroGeracao.message : 'Não deu para começar a geração.' })

  // Daqui em diante, um erro inesperado marca a geração como falha (antes ela ficava "pendente" para sempre).
  try {
    return await gerarComIa({ event, supabase, usuario, config, conteudo, misto, geracao, pedido, contexto, textoOutraIa, quantidadeIa })
  }
  catch (e) {
    if (!e?.statusCode) {
      await supabase.from('ia_geracoes').update({ status: 'falhou', motivo_falha: 'Erro inesperado no servidor.', concluido_em: new Date().toISOString() }).eq('id', geracao.id).then(() => {}, () => {})
    }
    throw e
  }
}

async function gerarComIa({ event, supabase, usuario, config, conteudo, misto, geracao, pedido, contexto, textoOutraIa, quantidadeIa }) {
  const salvasSemIa = misto?.escolhidas.length ? await gravarLocais(supabase, usuario.sub, conteudo, misto.escolhidas, geracao.id) : 0
  const permiteTreino = conteudo.permiteTreino
  const inicio = Date.now()

  // Até 10 questões por chamada à IA: um pedido de 20 vira dois lotes, um depois do outro.
  const lotes = dividirNiveis(niveisDoContexto(contexto), LOTE_IA)
  let aprovadas = []
  let reprovadas = []
  let refeitas = 0
  let modelo = null
  for (const [n, niveisLote] of lotes.entries()) {
    const quantos = somaNiveis(niveisLote)
    const doLote = lotes.length === 1 ? { pedido, contexto } : montarPedido(conteudo, config, niveisLote)
    let primeira
    try {
      primeira = await executarCascata(event, {
        tarefa: 'gerar', permiteTreino, usuarioId: usuario.sub, mensagens: doLote.pedido.mensagens,
        validar: (json) => {
          const r = validarGeradas(json, doLote.contexto)
          return r.aprovadas.length || r.reprovadas.length ? { ok: true, valor: r } : { ok: false, motivo: 'Nenhuma questão na resposta.' }
        },
      })
    }
    catch (erro) {
      if (!(erro instanceof FalhaCascata)) throw erro
      if (n > 0) break // o primeiro lote já deu certo: fica com o que veio
      const motivo = explicarFalha(erro.tentativas)
      await supabase.from('ia_geracoes').update({ status: 'falhou', salvas: salvasSemIa, motivo_falha: motivo.slice(0, 400), concluido_em: new Date().toISOString() }).eq('id', geracao.id)
      return { status: 'falhou', geracaoId: geracao.id, motivo, salvasSemIa, pedido: textoOutraIa(), materialSoSemTreino: conteudo.materiais.length > 0 && !permiteTreino }
    }
    modelo ??= primeira.modelo
    let boas = primeira.valor.aprovadas.slice(0, quantos)
    let ruins = primeira.valor.reprovadas
    if (ruins.length && boas.length < quantos) {
      try {
        const segunda = await executarCascata(event, {
          tarefa: 'refazer', permiteTreino, usuarioId: usuario.sub, maxTentativas: 1,
          mensagens: montarPedidoRefazer(doLote.pedido.mensagens, ruins.slice(0, quantos - boas.length)),
          validar: (json) => ({ ok: true, valor: validarGeradas(json, doLote.contexto) }),
        })
        const novas = segunda.valor.aprovadas.slice(0, quantos - boas.length)
        refeitas += novas.length
        boas = [...boas, ...novas]
        ruins = segunda.valor.reprovadas.length ? segunda.valor.reprovadas : ruins.slice(novas.length)
      }
      catch (erro) {
        if (!(erro instanceof FalhaCascata)) throw erro
      }
    }
    aprovadas = [...aprovadas, ...boas]
    reprovadas = [...reprovadas, ...ruins]
  }

  const linhas = linhasDaIa(conteudo, aprovadas.map((q) => ({ ...q, conteudo: embaralharAlternativas(q.conteudo) })), { geracaoId: geracao.id, modeloId: modelo.id })
  if (linhas.length) {
    const { error } = await supabase.from('questoes').insert(linhas)
    if (error) {
      await supabase.from('ia_geracoes').update({ status: 'falhou', salvas: salvasSemIa, motivo_falha: 'Não deu para salvar as questões.', concluido_em: new Date().toISOString() }).eq('id', geracao.id)
      throw createError({ statusCode: error.code === 'P0001' ? 409 : 500, statusMessage: error.code === 'P0001' ? error.message : 'Não deu para salvar as questões. Tente de novo.' })
    }
  }
  const salvas = salvasSemIa + linhas.length
  await supabase.from('ia_geracoes').update({
    status: linhas.length ? 'concluida' : 'falhou',
    modelo_id: modelo.id,
    modelo_nome: nomeDoModelo(modelo),
    salvas,
    refeitas,
    descartadas: descartadasParaGravar(reprovadas, quantidadeIa - linhas.length),
    latencia_ms: Date.now() - inicio,
    motivo_falha: linhas.length ? null : 'Nenhuma questão passou na conferência.',
    concluido_em: new Date().toISOString(),
  }).eq('id', geracao.id)
  return {
    status: linhas.length ? 'concluida' : 'falhou',
    geracaoId: geracao.id,
    salvas,
    salvasSemIa,
    motivo: linhas.length ? undefined : 'Nenhuma questão passou na conferência. Tente de novo ou mude os tipos.',
    pedido: linhas.length ? undefined : textoOutraIa(),
  }
}
