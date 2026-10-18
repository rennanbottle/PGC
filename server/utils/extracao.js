// Extração do texto de um material já guardado no bucket (usada pelo envio e pela busca de tema na Wikipédia).
// Lê o arquivo, separa em trechos, acha conceitos e grava uma versão nova; deixa o material "aguardando conferência".
// Com { aprovar: true } (texto de fonte aberta, já revisado pela comunidade), as páginas e os conceitos já saem
// aprovados e o material fica "pronto".
// Roda com o cliente da sessão da pessoa (RLS). Nunca registra o texto em log.
import { prepararMaterial } from '#shared/regras/analise.js'
import { FalhaMaterial, conferirTexto, lerDocx, lerPdf, lerTxt } from './leitores.js'
import { emLotes } from './consultas.js'

export async function extrairMaterial(supabase, material, assuntoId = null, { aprovar = false } = {}) {
  const id = material.id
  const agora = new Date().toISOString()
  await supabase.from('materiais').update({ status: 'extraindo', erro_codigo: null }).eq('id', id)
  let versaoId = null
  try {
    if (!material.arquivo_caminho) throw new FalhaMaterial('arquivo_nao_encontrado')
    const { data: arquivo, error: erroArquivo } = await supabase.storage.from('materiais').download(material.arquivo_caminho)
    if (erroArquivo || !arquivo) throw new FalhaMaterial('arquivo_nao_encontrado')
    const bytes = new Uint8Array(await arquivo.arrayBuffer())

    const paginas = material.formato === 'pdf' ? await lerPdf(bytes) : material.formato === 'docx' ? await lerDocx(bytes) : lerTxt(bytes)
    conferirTexto(paginas, material.formato)
    const resultado = prepararMaterial(paginas)

    const { data: ultima } = await supabase.from('material_versoes').select('numero').eq('material_id', id).order('numero', { ascending: false }).limit(1).maybeSingle()
    const { data: versao, error: erroVersao } = await supabase
      .from('material_versoes')
      .insert({ material_id: id, numero: (ultima?.numero ?? 0) + 1, total_caracteres: resultado.analise.caracteres, analise: resultado.analise, aprovada_em: aprovar ? agora : null })
      .select('id')
      .single()
    if (erroVersao) throw erroVersao
    versaoId = versao.id

    const { error: erroPaginas } = await supabase.from('material_paginas').insert(resultado.paginas.map((p) => ({ versao_id: versaoId, numero: p.numero, palavras: p.palavras, conferida_em: aprovar ? agora : null })))
    if (erroPaginas) throw erroPaginas

    const idsPorOrdem = new Map()
    for (const lote of emLotes(resultado.trechos, 500)) {
      const { data, error } = await supabase
        .from('material_trechos')
        .insert(lote.map((t) => ({ versao_id: versaoId, ordem: t.ordem, pagina: t.pagina, tipo: t.tipo, texto: t.texto, usar_em_questoes: t.usar, assunto_id: t.usar ? assuntoId : null })))
        .select('id, ordem')
      if (error) throw error
      for (const d of data) idsPorOrdem.set(Number(d.ordem), d.id)
    }

    for (const lote of emLotes(resultado.conceitos, 500)) {
      const { error } = await supabase.from('conceitos').insert(lote.map((c) => ({
        versao_id: versaoId,
        trecho_id: idsPorOrdem.get(c.trechoOrdem) ?? null,
        assunto_id: assuntoId,
        tipo: c.tipo,
        termo: c.termo,
        definicao: c.definicao || null,
        pagina: c.pagina,
        status: aprovar ? 'aprovado' : 'sugerido',
      })))
      if (error) throw error
    }

    const status = aprovar ? 'pronto' : 'aguardando_conferencia'
    await supabase.from('materiais').update({ status, paginas: resultado.paginas.length, erro_codigo: null }).eq('id', id)
    return { status }
  }
  catch (erro) {
    const codigo = erro instanceof FalhaMaterial ? erro.codigo : 'falha_extracao'
    if (!(erro instanceof FalhaMaterial)) console.error('[extrair] material', id, erro?.code ?? erro?.name ?? 'erro')
    // Versão pela metade não fica: apaga (as páginas, trechos e conceitos vão junto).
    if (versaoId) await supabase.from('material_versoes').delete().eq('id', versaoId)
    await supabase.from('materiais').update({ status: 'erro', erro_codigo: codigo }).eq('id', id)
    return { status: 'erro', erro: codigo }
  }
}
