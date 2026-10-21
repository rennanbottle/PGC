// Estudo no navegador: números do estudo (resumo_estudo), conjuntos salvos e as chamadas ao servidor.
// Correção, pontos e proficiência acontecem no servidor (rotas /api/revisoes/...); aqui só pedimos e mostramos.
// Cada "revisão" no banco é uma execução: um estudo em blocos de Revisão e Prática.

export const ESTUDO_VAZIO = {
  hoje: 0, dias_seguidos: 0, por_dia: Array(14).fill(0), semana: 0, semana_anterior: 0, respondidas: 0, tipos_usados: 0,
  revisoes_concluidas: 0, revisoes_com5: 0, revisoes_com10: 0, proficientes: 0, dominados: 0, pontos: 0, pontos_hoje: 0,
  vencidas: 0, erros_14: 0, acerto_ultimas: [], em_andamento: null,
}

export function useResumoEstudo() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData('estudo-resumo', async () => {
    if (!usuario.value) return ESTUDO_VAZIO
    const { data, error } = await supabase.rpc('resumo_estudo')
    if (error) return ESTUDO_VAZIO
    return { ...ESTUDO_VAZIO, ...data }
  }, { watch: [() => usuario.value?.sub], default: () => ESTUDO_VAZIO })
}

function mensagemDe(erro, padrao) {
  return erro?.data?.statusMessage || erro?.statusMessage || padrao
}
async function chamar(url, opcoes, padrao) {
  try {
    return await $fetch(url, opcoes)
  }
  catch (e) {
    throw new Error(mensagemDe(e, padrao))
  }
}

export function useRevisoes() {
  const depois = () => refreshNuxtData(['estudo-resumo', 'revisoes-lista', 'questoes-resumo', 'conjuntos-lista'])
  return {
    previa: (blocos) => chamar('/api/revisoes/previa', { method: 'POST', body: { blocos } }, 'Não deu para montar a prévia agora.'),
    // corpo: { blocos, nome?, receita?, conjuntoId? } ou { refazer: id }
    async criar(corpo) {
      const r = await chamar('/api/revisoes', { method: 'POST', body: corpo }, 'Não deu para começar agora.')
      depois()
      return r
    },
    carregar: (id) => chamar(`/api/revisoes/${id}`, {}, 'Não deu para abrir a revisão.'),
    responder: (id, corpo) => chamar(`/api/revisoes/${id}/responder`, { method: 'POST', body: corpo }, 'Não deu para enviar a resposta. Confira a internet e tente de novo.'),
    dica: (id, itemId) => chamar(`/api/revisoes/${id}/dica`, { method: 'POST', body: { itemId } }, 'Não deu para abrir a dica.'),
    estado: (id, corpo) => chamar(`/api/revisoes/${id}/estado`, { method: 'POST', body: corpo }, 'Não deu para salvar agora.'),
    async concluir(id, encerrar = false) {
      const r = await chamar(`/api/revisoes/${id}/concluir`, { method: 'POST', body: { encerrar } }, 'Não deu para fechar a revisão agora.')
      depois()
      return r
    },
    resultado: (id) => chamar(`/api/revisoes/${id}/resultado`, {}, 'Não deu para abrir o resultado.'),
    proximoBloco: (id, bloco, extra = {}) => chamar(`/api/revisoes/${id}/estado`, { method: 'POST', body: { ...extra, acao: 'bloco', bloco } }, 'Não deu para abrir o próximo bloco.'),
    comentario: (id) => chamar(`/api/revisoes/${id}/comentario`, { method: 'POST' }, 'Não deu para pedir o comentário agora.'),
  }
}

// Conjuntos salvos: a lista vem direto do banco (cada pessoa só lê os próprios); salvar e apagar passam pelo
// servidor, que confere os blocos com as mesmas regras da execução.
export function useConjuntos() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  const lista = useAsyncData('conjuntos-lista', async () => {
    if (!usuario.value) return []
    const { data } = await supabase.from('conjuntos').select('id, nome, blocos, atualizado_em').order('atualizado_em', { ascending: false }).limit(100)
    return data ?? []
  }, { watch: [() => usuario.value?.sub], default: () => [] })
  const depois = () => refreshNuxtData('conjuntos-lista')
  return {
    lista,
    async salvar({ id, nome, blocos }) {
      const r = id
        ? await chamar(`/api/conjuntos/${id}`, { method: 'PUT', body: { nome, blocos } }, 'Não deu para salvar o conjunto.')
        : await chamar('/api/conjuntos', { method: 'POST', body: { nome, blocos } }, 'Não deu para salvar o conjunto.')
      depois()
      return r
    },
    async apagar(id) {
      await chamar(`/api/conjuntos/${id}`, { method: 'DELETE' }, 'Não deu para apagar o conjunto.')
      depois()
    },
  }
}
