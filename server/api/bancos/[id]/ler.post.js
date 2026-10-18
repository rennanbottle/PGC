// POST /api/bancos/:id/ler
// Lê o arquivo do banco importado (PDF, DOCX, TXT, CSV ou XLSX) no bucket privado "bancos",
// reconhece as questões e o gabarito, sugere o assunto e grava tudo como rascunho para a pessoa conferir.
// Roda com a sessão da pessoa (RLS). Nunca registra o texto do arquivo em log.
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { linhasRepetidas } from '#shared/regras/analise.js'
import { lerBancoDePlanilha, lerBancoDeTexto, lerCsv, sugerirAssunto } from '#shared/regras/importarBanco.js'
import { conferirQuestao } from '#shared/regras/questoes.js'
import { FalhaMaterial, conferirTexto, lerDocx, lerPdf, lerTxt, lerXlsx } from '../../../utils/leitores.js'
import { UUID, emLotes, todasAsLinhas } from '../../../utils/consultas.js'

const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default defineEventHandler(async (event) => {
  const usuario = await serverSupabaseUser(event).catch(() => null)
  if (!usuario?.sub) throw createError({ statusCode: 401, statusMessage: 'Entre de novo para continuar.' })
  const id = getRouterParam(event, 'id')
  if (!UUID.test(id ?? '')) throw createError({ statusCode: 400, statusMessage: 'Banco inválido.' })

  const supabase = await serverSupabaseClient(event)
  const { data: banco } = await supabase.from('bancos_importados').select('id, materia_id, formato, arquivo_caminho, status').eq('id', id).maybeSingle()
  if (!banco) throw createError({ statusCode: 404, statusMessage: 'Banco não encontrado.' })
  if (!['enviando', 'lendo', 'erro'].includes(banco.status)) return { status: banco.status }

  await supabase.from('bancos_importados').update({ status: 'lendo', erro_codigo: null }).eq('id', id)
  try {
    if (!banco.arquivo_caminho) throw new FalhaMaterial('arquivo_nao_encontrado')
    const { data: arquivo, error: erroArquivo } = await supabase.storage.from('bancos').download(banco.arquivo_caminho)
    if (erroArquivo || !arquivo) throw new FalhaMaterial('arquivo_nao_encontrado')
    const bytes = new Uint8Array(await arquivo.arrayBuffer())

    let lido
    let paginas = null
    if (banco.formato === 'csv' || banco.formato === 'xlsx') {
      let texto = new TextDecoder('utf-8').decode(bytes)
      if (banco.formato === 'csv' && (texto.match(/�/g) ?? []).length > 5) texto = new TextDecoder('windows-1252').decode(bytes)
      const linhas = banco.formato === 'csv' ? lerCsv(texto) : await lerXlsx(bytes)
      lido = lerBancoDePlanilha(linhas.slice(0, 2001))
      if (lido.colunasFaltando.length) throw new FalhaMaterial('colunas_faltando')
    }
    else {
      const lidas = banco.formato === 'pdf' ? await lerPdf(bytes) : banco.formato === 'docx' ? await lerDocx(bytes) : lerTxt(bytes)
      conferirTexto(lidas, banco.formato)
      paginas = lidas.length
      lido = lerBancoDeTexto(lidas, { repetidas: linhasRepetidas(lidas) })
    }
    const questoes = lido.questoes.slice(0, 2000)
    if (!questoes.length) throw new FalhaMaterial('nenhuma_questao')

    // Assunto: pelo nome na planilha ou sugerido pelas palavras (nome do assunto e termos aprovados do material).
    const { data: assuntos } = await supabase.from('assuntos').select('id, nome').eq('materia_id', banco.materia_id).is('arquivado_em', null)
    const ids = (assuntos ?? []).map((a) => a.id)
    const termos = ids.length
      ? await todasAsLinhas((de, ate) => supabase.from('conceitos').select('termo, assunto_id').in('assunto_id', ids).eq('status', 'aprovado').range(de, ate), 1000, 5000).catch(() => [])
      : []
    const comPalavras = (assuntos ?? []).map((a) => ({ ...a, palavras: termos.filter((t) => t.assunto_id === a.id).map((t) => t.termo) }))
    const porNome = new Map(comPalavras.map((a) => [semAcento(a.nome), a.id]))

    const linhas = questoes.map((q) => {
      const assuntoId = (q.assuntoNome && porNome.get(semAcento(q.assuntoNome))) || sugerirAssunto(`${q.enunciado} ${(q.conteudo.alternativas ?? []).map((a) => a.texto).join(' ')}`, comPalavras)?.id || null
      const conferencia = conferirQuestao({ tipo: q.tipo, enunciado: q.enunciado, conteudo: q.conteudo }, { importada: true })
      return {
        usuario_id: usuario.sub,
        materia_id: banco.materia_id,
        assunto_id: assuntoId,
        banco_id: id,
        tipo: q.tipo,
        nivel: 2,
        bloom: 1,
        enunciado: q.enunciado.slice(0, 5000),
        conteudo: q.conteudo,
        explicacao: q.explicacao ? String(q.explicacao).slice(0, 3000) : null,
        fonte: q.fonte ? q.fonte.slice(0, 200) : null,
        origem: 'importada',
        status: 'rascunho',
        gabarito_confirmado: !!q.gabaritoConfirmado,
        resolver_comparar: !!q.aberta,
        qualidade_aprovada: conferencia.aprovada,
        avisos_qualidade: conferencia.problemas,
        precisa_imagem: !!q.precisaImagem,
        numero_original: Math.min(2000, Math.max(1, q.numero || 1)),
        trecho_original: q.trechoOriginal || null,
      }
    })
    for (const lote of emLotes(linhas, 300)) {
      const { error } = await supabase.from('questoes').insert(lote)
      if (error) throw error
    }

    await supabase.from('bancos_importados').update({
      status: 'aguardando_conferencia',
      paginas,
      total_reconhecido: linhas.length,
      total_com_gabarito: linhas.filter((l) => l.gabarito_confirmado).length,
      total_com_figura: linhas.filter((l) => l.precisa_imagem).length,
      gabarito_pagina: lido.gabaritoPagina ?? null,
      erro_codigo: null,
    }).eq('id', id)
    return { status: 'aguardando_conferencia', total: linhas.length }
  }
  catch (erro) {
    const codigo = erro instanceof FalhaMaterial ? erro.codigo : erro?.code === 'P0001' ? 'limite' : 'falha_leitura'
    if (!(erro instanceof FalhaMaterial)) console.error('[ler banco]', id, erro?.code ?? erro?.name ?? 'erro')
    // Rascunho pela metade não fica.
    await supabase.from('questoes').delete().eq('banco_id', id).eq('status', 'rascunho')
    await supabase.from('bancos_importados').update({ status: 'erro', erro_codigo: codigo }).eq('id', id)
    return { status: 'erro', erro: codigo, mensagem: codigo === 'limite' ? erro.message : undefined }
  }
})
