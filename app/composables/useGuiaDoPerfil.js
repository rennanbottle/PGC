// Depois do cadastro: aplica o guia escolhido. O próprio (criado no cadastro) espera neste navegador e é enviado
// agora; o pronto vem dos dados do cadastro. Só age quando o perfil ainda não tem guia. Chamar no navegador.
import { GUIAS_PRONTOS, nomeParaGuardar } from '#shared/regras/guias.js'

export function useGuiaDoPerfil() {
  const supabase = useSupabaseClient()
  const usuario = useSupabaseUser()
  let feito = false

  async function aplicar(perfil) {
    if (feito || !perfil || perfil.guia || !usuario.value?.sub) return
    feito = true
    const pendente = lerGuiaPendente(usuario.value.email)
    try {
      if (pendente?.dados) {
        await enviarGuia(supabase, usuario.value.sub, dataUrlParaBlob(pendente.dados), { nome: pendente.nome, versao: perfil.guia_versao ?? 0 })
        limparGuiaPendente()
      }
      else {
        const escolhido = usuario.value.user_metadata?.guia
        if (!GUIAS_PRONTOS.some((g) => g.id === escolhido)) return
        const nome = nomeParaGuardar(escolhido, usuario.value.user_metadata?.guia_nome)
        await supabase.from('perfis').update({ guia: escolhido, guia_nome: nome }).eq('id', usuario.value.sub)
      }
      await refreshNuxtData('perfil')
    }
    catch {
      feito = false // tenta de novo no próximo acesso
    }
  }

  return { aplicar }
}
