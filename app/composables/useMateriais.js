// Materiais da pessoa logada, com envio (barra de progresso), extração e as ações do menu.
// Lista compartilhada pela chave "materiais" (biblioteca, página da matéria, busca e estatísticas).
// O arquivo vai direto do navegador para o bucket privado; o servidor só lê de lá para extrair o texto.
import { FORMATOS } from '#shared/regras/materiais.js'

function traduzir(erro) {
  if (erro?.code === 'P0001') return erro.message
  if (erro?.code === '23503') return 'A matéria escolhida não existe mais. Recarregue a página.'
  if (erro?.code === '23514') return 'Algum valor não foi aceito. Confira os campos.'
  return 'Não deu para salvar agora. Confira a internet e tente de novo.'
}

export function useMateriais() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  const config = useRuntimeConfig()

  const consulta = useAsyncData(
    'materiais',
    async () => {
      if (!usuario.value) return []
      const { data, error } = await supabase
        .from('materiais')
        .select('id, materia_id, titulo, origem, formato, status, arquivo_caminho, arquivo_nome, tamanho_bytes, paginas, erro_codigo, ia_permitida, fonte_url, fonte_licenca, arquivado_em, criado_em, atualizado_em, material_versoes(id, numero, aprovada_em, material_paginas(conferida_em))')
        .order('criado_em', { ascending: false })
      if (error) throw error
      // Só a versão mais recente interessa à lista.
      return data.map((m) => {
        const versao = [...(m.material_versoes ?? [])].sort((a, b) => b.numero - a.numero)[0] ?? null
        const paginas = versao?.material_paginas ?? []
        return { ...m, material_versoes: undefined, versaoId: versao?.id ?? null, paginasConferidas: paginas.filter((p) => p.conferida_em).length, paginasTotal: paginas.length }
      })
    },
    { watch: [() => usuario.value?.sub], default: () => [] },
  )
  const recarregar = () => refreshNuxtData('materiais')

  async function executar(pedido) {
    const { data, error } = await pedido
    if (error) throw new Error(traduzir(error))
    return data
  }

  const subir = (caminho, corpo, tipo, aoProgredir, sinal) => enviarParaBucket({
    supabase, url: config.public.supabase.url, chave: config.public.supabase.key, bucket: 'materiais', caminho, corpo, tipo, aoProgredir, sinal,
  })

  // Cria o material, envia o arquivo e pede a extração. Devolve { id, status, erro? }.
  async function enviar({ corpo, formato, origem, titulo, nomeArquivo, materiaId, assuntoId, ia }, aoProgredir, sinal) {
    const tamanho = corpo.size
    const material = await executar(supabase.from('materiais').insert({
      materia_id: materiaId,
      titulo,
      origem,
      formato,
      arquivo_nome: nomeArquivo,
      tamanho_bytes: tamanho,
      ia_permitida: ia,
    }).select('id').single())
    const caminho = `${usuario.value.sub}/${material.id}/original.${FORMATOS[formato].extensao}`
    try {
      await subir(caminho, corpo, FORMATOS[formato].mime, aoProgredir, sinal)
    }
    catch (erro) {
      // Envio que não chegou não deixa material pela metade.
      await supabase.from('materiais').delete().eq('id', material.id)
      await recarregar()
      throw erro
    }
    await executar(supabase.from('materiais').update({ arquivo_caminho: caminho, status: 'extraindo' }).eq('id', material.id))
    recarregar()
    const resposta = await extrair(material.id, assuntoId)
    return { id: material.id, ...resposta }
  }

  async function extrair(id, assuntoId = null) {
    try {
      const resposta = await $fetch(`/api/materiais/${id}/extrair`, { method: 'POST', body: { assuntoId } })
      return resposta
    }
    catch {
      return { status: 'erro', erro: 'falha_extracao' }
    }
    finally {
      await recarregar()
      refreshNuxtData(`material-${id}`)
    }
  }

  async function atualizar(id, campos) {
    await executar(supabase.from('materiais').update(campos).eq('id', id))
    await recarregar()
    refreshNuxtData(`material-${id}`)
  }

  const arquivar = (id, sim = true) => atualizar(id, { arquivado_em: sim ? new Date().toISOString() : null })

  async function excluir(material) {
    if (material.arquivo_caminho) await supabase.storage.from('materiais').remove([material.arquivo_caminho])
    await executar(supabase.from('materiais').delete().eq('id', material.id))
    await recarregar()
  }

  // "Está bom, usar tudo": aprova todas as páginas e conceitos da versão de uma vez e deixa o texto pronto.
  async function aprovarTudo(id, versaoId) {
    const agora = new Date().toISOString()
    await executar(supabase.from('material_paginas').update({ conferida_em: agora }).eq('versao_id', versaoId).is('conferida_em', null))
    await executar(supabase.from('conceitos').update({ status: 'aprovado' }).eq('versao_id', versaoId).eq('status', 'sugerido'))
    await executar(supabase.from('material_versoes').update({ aprovada_em: agora }).eq('id', versaoId))
    await executar(supabase.from('materiais').update({ status: 'pronto' }).eq('id', id))
    await recarregar()
    refreshNuxtData(`material-${id}`)
  }

  // Traz uma página do Wikilivros, da Wikiversidade ou da Wikipédia (só as seções escolhidas). Já chega aprovada.
  async function importarAberto({ fonte, titulo, materiaId, assuntoId = null, secoes = null }) {
    try {
      return await $fetch('/api/materiais/wikipedia', { method: 'POST', body: { fonte, titulo, materiaId, assuntoId, secoes } })
    }
    catch (e) {
      throw new Error(e?.data?.statusMessage ?? 'Não deu para trazer o texto agora. Tente de novo.')
    }
    finally {
      await recarregar()
    }
  }

  // Link temporário (60 segundos) para baixar o arquivo original.
  async function linkDoOriginal(material) {
    const { data, error } = await supabase.storage.from('materiais').createSignedUrl(material.arquivo_caminho, 60, { download: material.arquivo_nome || true })
    if (error) throw new Error('Não deu para gerar o link agora. Tente de novo.')
    return data.signedUrl
  }

  return {
    data: consulta.data,
    pending: consulta.pending,
    error: consulta.error,
    pronto: consulta,
    recarregar,
    enviar,
    extrair,
    atualizar,
    arquivar,
    excluir,
    linkDoOriginal,
    aprovarTudo,
    importarAberto,
  }
}

// Um material com a versão mais recente, a análise e as páginas (página do material e conferência).
export function useMaterial(id) {
  const supabase = useSupabaseClient()
  return useAsyncData(`material-${id}`, async () => {
    const { data, error } = await supabase
      .from('materiais')
      .select('*, material_versoes(id, numero, total_caracteres, analise, criada_em, aprovada_em, material_paginas(numero, palavras, conferida_em))')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const versao = [...(data.material_versoes ?? [])].sort((a, b) => b.numero - a.numero)[0] ?? null
    if (versao) versao.material_paginas = [...versao.material_paginas].sort((a, b) => a.numero - b.numero)
    return { material: { ...data, material_versoes: undefined }, versao }
  })
}
