// Bancos de questões importados: envio do arquivo, leitura no servidor, conferência e exclusão.
// Lista compartilhada pela chave "bancos" (tela de Questões, conferência e estatísticas).
import { FORMATOS_BANCO } from '#shared/regras/bancos.js'

function traduzir(erro) {
  if (erro?.code === 'P0001') return erro.message
  if (erro?.code === '23503') return 'A matéria escolhida não existe mais. Recarregue a página.'
  return 'Não deu para salvar agora. Confira a internet e tente de novo.'
}

export function useBancos() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  const config = useRuntimeConfig()

  const consulta = useAsyncData('bancos', async () => {
    if (!usuario.value) return []
    const { data, error } = await supabase
      .from('bancos_importados')
      .select('id, materia_id, titulo, formato, status, arquivo_caminho, arquivo_nome, paginas, erro_codigo, total_reconhecido, total_com_gabarito, total_com_figura, gabarito_pagina, criado_em, concluido_em')
      .order('criado_em', { ascending: false })
    if (error) throw error
    return data
  }, { watch: [() => usuario.value?.sub], default: () => [] })
  const recarregar = () => refreshNuxtData(['bancos', 'questoes-resumo', 'questoes-lista'])

  async function executar(pedido) {
    const { data, error } = await pedido
    if (error) throw new Error(traduzir(error))
    return data
  }

  // Cria o banco, envia o arquivo e pede a leitura. Devolve { id, status, erro? }.
  async function importar({ arquivo, formato, titulo, materiaId }, aoProgredir, sinal) {
    const banco = await executar(supabase.from('bancos_importados').insert({
      materia_id: materiaId,
      titulo,
      formato,
      arquivo_nome: arquivo.name.slice(0, 200),
      tamanho_bytes: arquivo.size,
    }).select('id').single())
    const caminho = `${usuario.value.sub}/${banco.id}/original.${FORMATOS_BANCO[formato].extensao}`
    try {
      await enviarParaBucket({ supabase, url: config.public.supabase.url, chave: config.public.supabase.key, bucket: 'bancos', caminho, corpo: arquivo, tipo: FORMATOS_BANCO[formato].mime, aoProgredir, sinal })
    }
    catch (erro) {
      await supabase.from('bancos_importados').delete().eq('id', banco.id)
      throw erro
    }
    await executar(supabase.from('bancos_importados').update({ arquivo_caminho: caminho, status: 'lendo' }).eq('id', banco.id))
    return { id: banco.id, ...(await ler(banco.id)) }
  }

  async function ler(id) {
    try {
      return await $fetch(`/api/bancos/${id}/ler`, { method: 'POST' })
    }
    catch {
      return { status: 'erro', erro: 'falha_leitura' }
    }
    finally {
      recarregar()
    }
  }

  // Aprova as questões escolhidas (passam de rascunho a ativas) e fecha o banco quando não sobra rascunho.
  async function aprovar(bancoId, ids) {
    if (ids.length) await executar(supabase.from('questoes').update({ status: 'ativa' }).in('id', ids).eq('banco_id', bancoId))
    await fecharSeTerminou(bancoId)
    recarregar()
  }

  async function descartar(bancoId, ids) {
    if (ids.length) await executar(supabase.from('questoes').delete().in('id', ids).eq('banco_id', bancoId).eq('status', 'rascunho'))
    await fecharSeTerminou(bancoId)
    recarregar()
  }

  async function fecharSeTerminou(bancoId) {
    const { count } = await supabase.from('questoes').select('id', { count: 'exact', head: true }).eq('banco_id', bancoId).eq('status', 'rascunho')
    if (count === 0) await supabase.from('bancos_importados').update({ status: 'concluido', concluido_em: new Date().toISOString() }).eq('id', bancoId)
  }

  // Exclui o banco: os rascunhos e o arquivo saem; as questões já aprovadas ficam no banco de questões.
  async function excluir(banco) {
    await executar(supabase.from('questoes').delete().eq('banco_id', banco.id).eq('status', 'rascunho'))
    if (banco.arquivo_caminho) await supabase.storage.from('bancos').remove([banco.arquivo_caminho])
    await executar(supabase.from('bancos_importados').delete().eq('id', banco.id))
    recarregar()
  }

  return { data: consulta.data, pending: consulta.pending, error: consulta.error, pronto: consulta, recarregar, importar, ler, aprovar, descartar, excluir }
}
