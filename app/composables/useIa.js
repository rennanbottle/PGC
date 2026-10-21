// IA do lado do navegador: cota do dia, gerar, colar a resposta de outra IA, sugerir gabarito e saber se é dono.
// Toda chamada a modelo acontece no servidor (rotas /api/ia/...); aqui só pedimos e mostramos.

// Mensagem do servidor, ou a frase padrão com o código do erro quando o servidor não explicou (ex.: "Server Error").
const GENERICAS = new Set(['Server Error', 'Internal Server Error', 'Bad Request', 'Not Found', 'Forbidden', 'Unauthorized'])
function mensagemDe(erro, padrao) {
  const m = erro?.data?.statusMessage || erro?.statusMessage
  if (m && !GENERICAS.has(m)) return m
  const codigo = erro?.statusCode ?? erro?.status
  return codigo ? `${padrao} (erro ${codigo})` : padrao
}

// Copia um texto (o pedido para outra IA). Sem a área de transferência moderna (página sem HTTPS ou navegador
// antigo), usa o jeito antigo: um campo escondido, selecionado e copiado.
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto)
    return
  }
  catch {
    const campo = document.createElement('textarea')
    campo.value = texto
    campo.setAttribute('readonly', '')
    campo.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(campo)
    campo.select()
    const ok = document.execCommand?.('copy')
    campo.remove()
    if (!ok) throw new Error('Não deu para copiar.')
  }
}

export function useCotaIa() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData('ia-cota', async () => {
    if (!usuario.value) return { usadas: 0, limite: 30 }
    const { data, error } = await supabase.rpc('ia_minha_cota')
    if (error) throw error
    return data
  }, { watch: [() => usuario.value?.sub], default: () => ({ usadas: 0, limite: 30 }) })
}

export function useSouDono() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  return useAsyncData('sou-dono', async () => {
    if (!usuario.value) return false
    const { data } = await supabase.rpc('sou_dono')
    return data === true
  }, { watch: [() => usuario.value?.sub], default: () => false })
}

export function useIa() {
  const depois = () => refreshNuxtData(['ia-cota', 'questoes-resumo', 'questoes-lista'])

  async function gerar(pedido) {
    try {
      return await $fetch('/api/ia/gerar', { method: 'POST', body: pedido })
    }
    catch (e) {
      throw new Error(mensagemDe(e, 'Não deu para gerar agora. Confira a internet e tente de novo.'))
    }
    finally {
      depois()
    }
  }

  async function colar(geracaoId, resposta) {
    try {
      return await $fetch('/api/ia/colar', { method: 'POST', body: { geracaoId, resposta } })
    }
    catch (e) {
      throw new Error(mensagemDe(e, 'Não deu para conferir a resposta agora.'))
    }
    finally {
      depois()
    }
  }

  async function sugerirGabarito(questaoId) {
    try {
      return await $fetch('/api/ia/gabarito', { method: 'POST', body: { questaoId } })
    }
    catch (e) {
      throw new Error(mensagemDe(e, 'Não deu para pedir a sugestão agora.'))
    }
  }

  // Página "Gerar questões": prévia (sem gravar nada), gerar e colar a resposta de outra IA.
  async function previaDaPagina(config) {
    try {
      return await $fetch('/api/questoes/gerar', { method: 'POST', body: { ...config, acao: 'previa' } })
    }
    catch (e) {
      throw new Error(mensagemDe(e, 'Não deu para montar a prévia agora.'))
    }
  }
  async function gerarDaPagina(config, acao = 'gerar', resposta = '') {
    try {
      return await $fetch('/api/questoes/gerar', { method: 'POST', body: { ...config, acao, resposta } })
    }
    catch (e) {
      throw new Error(mensagemDe(e, 'Não deu para gerar agora. Confira a internet e tente de novo.'))
    }
    finally {
      depois()
    }
  }

  return { gerar, colar, sugerirGabarito, gabarito: sugerirGabarito, previaDaPagina, gerarDaPagina }
}
