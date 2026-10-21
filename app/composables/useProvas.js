// Prova no navegador: lista, montar (prévia e criar), guardar respostas e entregar.
// A correção acontece no servidor, de uma vez, quando a pessoa entrega (rotas /api/provas/...).

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

export function useListaProvas() {
  return useFetch('/api/provas', { key: 'provas-lista', default: () => ({ provas: [], agendadas: [] }) })
}

export function useProvas() {
  const depois = () => refreshNuxtData(['provas-lista', 'estudo-resumo'])
  return {
    // corpo: { titulo, formato, assuntos: [{ id, peso }], quantas, minutos, relogio, ordem, fracos, trocar?, semente? }
    previa: (corpo) => chamar('/api/provas', { method: 'POST', body: { ...corpo, acao: 'previa' } }, 'Não deu para montar o caderno agora.'),
    async criar(corpo) {
      const r = await chamar('/api/provas', { method: 'POST', body: { ...corpo, acao: 'criar' } }, 'Não deu para criar a prova agora.')
      await depois()
      return r
    },
    // Prova de domínio de um assunto (o servidor confere se pode e sorteia as questões).
    async dominio(assuntoId) {
      const r = await chamar('/api/provas/dominio', { method: 'POST', body: { assuntoId } }, 'Não deu para montar a prova de domínio agora.')
      await depois()
      return r
    },
    // corpo: { itemId, resposta?, marcada?, atual? }. Só guarda: nada é corrigido antes de entregar.
    guardar: (id, corpo) => chamar(`/api/provas/${id}/guardar`, { method: 'POST', body: corpo }, 'Não deu para guardar a resposta. Confira a internet.'),
    // porTempo: o relógio zerou na tela (a prova aparece como entregue pelo tempo).
    async entregar(id, { porTempo = false } = {}) {
      const r = await chamar(`/api/provas/${id}/entregar`, { method: 'POST', body: { porTempo } }, 'Não deu para entregar agora. Suas respostas estão guardadas; tente de novo.')
      await depois()
      return r
    },
  }
}
