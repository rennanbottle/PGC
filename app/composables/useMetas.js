// Metas da pessoa: a lista com o progresso vem do servidor (/api/metas, que conta as respostas); criar, mudar e
// arquivar vão direto ao banco (cada pessoa só mexe nas próprias metas, e o banco recusa o resto).
import { validarMeta } from '#shared/regras/metas.js'
import { diaDeHoje } from '#shared/regras/agenda.js'

function traduzir(erro) {
  if (erro?.code === 'P0001') return erro.message
  if (erro?.code === '23503') return 'A matéria escolhida não existe mais. Recarregue a página.'
  if (erro?.code === '23514') return 'Algum valor não foi aceito. Confira os campos.'
  return 'Não deu para salvar a meta agora. Confira a internet e tente de novo.'
}

export function useListaMetas() {
  return useFetch('/api/metas', { key: 'metas', default: () => ({ hoje: null, diaria: null, metas: [] }) })
}

export function useMetas() {
  const supabase = useSupabaseClient()
  const recarregar = () => refreshNuxtData('metas')
  async function gravar(pedido) {
    const { error } = await pedido
    if (error) throw new Error(traduzir(error))
    await recarregar()
  }
  return {
    // Devolve { erros } quando algo do formulário não passa; grava e devolve {} quando dá certo.
    async salvar(campos, existente = null) {
      const { ok, erros, meta } = validarMeta(campos, diaDeHoje())
      if (!ok) return { erros }
      if (existente) await gravar(supabase.from('metas').update(meta).eq('id', existente.id))
      else await gravar(supabase.from('metas').insert(meta))
      return {}
    },
    arquivar: (meta) => gravar(supabase.from('metas').update({ arquivada_em: new Date().toISOString() }).eq('id', meta.id)),
    desarquivar: (meta) => gravar(supabase.from('metas').update({ arquivada_em: null }).eq('id', meta.id)),
    recarregar,
  }
}
